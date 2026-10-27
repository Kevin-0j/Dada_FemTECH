import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { AesGcmCipher, HmacHasher } from "../../src/adapters/crypto/node-crypto.ts";
import {
  ChainInterpreter,
  LlmInterpreter,
} from "../../src/adapters/interpreter/llm-interpreter.ts";
import { RuleBasedInterpreter } from "../../src/adapters/interpreter/rule-based-interpreter.ts";
import { LogNotifier, WebhookNotifier } from "../../src/adapters/notify/notifiers.ts";
import { loadConfig } from "../../src/config.ts";
import { testConfig } from "../support/fixtures.ts";

describe("RuleBasedInterpreter", () => {
  const rules = new RuleBasedInterpreter();
  const at = (itemIndex: number, text: string) =>
    rules.interpretSync({ itemIndex, language: "sheng", text });

  it.each([
    // Item 3 is a symptom item: option 1 is "most of the time" (score 3).
    [2, "mara mob", 0],
    [2, "saa zingine", 1],
    [2, "si sana", 2],
    [2, "never", 3],
    [2, "Hapana kabisa!", 3],
    [2, "ndio", 1],
    // Item 1 is a positive item: "kama kawaida" is the best answer (option 1).
    [0, "kama kawaida", 0],
    [0, "kiasi tu", 1],
    [0, "kidogo sana", 2],
    [0, "hata kidogo", 3],
    [0, "sana", 0],
  ])("item %i: %j is option %i", (item, text, option) => {
    expect(at(item, text)).toBe(option);
  });

  it("says it is unsure rather than guessing", () => {
    expect(at(2, "leo nimeenda sokoni")).toBeNull();
    expect(at(42, "sana")).toBeNull();
  });
});

describe("LlmInterpreter", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  /** A real HTTP server that behaves like an OpenAI-compatible API. */
  async function fakeModel(reply: (body: unknown) => { status: number; content: string }) {
    const requests: unknown[] = [];
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
      req.on("end", () => {
        const body: unknown = JSON.parse(raw);
        requests.push(body);
        const { status, content } = reply(body);
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${port}/v1`, requests };
  }

  it("returns the option the model picks and sends no phone number", async () => {
    const { baseUrl, requests } = await fakeModel(() => ({
      status: 200,
      content: '{"option": 2}',
    }));
    const llm = new LlmInterpreter({ baseUrl, model: "test", apiKey: "k", timeoutMs: 2000 });
    expect(await llm.interpret({ itemIndex: 2, language: "sheng", text: "kuna siku" })).toBe(1);
    expect(JSON.stringify(requests[0])).not.toMatch(/\+254/);
  });

  it("returns null when the model is unsure, wrong or down", async () => {
    let content = '{"option": null}';
    let status = 200;
    const { baseUrl } = await fakeModel(() => ({ status, content }));
    const llm = new LlmInterpreter({ baseUrl, model: "test", apiKey: null, timeoutMs: 2000 });
    const ask = () => llm.interpret({ itemIndex: 0, language: "en", text: "hmm" });

    expect(await ask()).toBeNull();
    content = '{"option": 9}';
    expect(await ask()).toBeNull();
    content = "I think it is the second one";
    expect(await ask()).toBeNull();
    status = 500;
    expect(await ask()).toBeNull();
    expect(await llm.interpret({ itemIndex: 99, language: "en", text: "x" })).toBeNull();
  });

  it("is only asked when the rules are unsure", async () => {
    const { baseUrl, requests } = await fakeModel(() => ({
      status: 200,
      content: '{"option": 4}',
    }));
    const chain = new ChainInterpreter([
      new RuleBasedInterpreter(),
      new LlmInterpreter({ baseUrl, model: "test", apiKey: null, timeoutMs: 2000 }),
    ]);
    expect(await chain.interpret({ itemIndex: 2, language: "sheng", text: "never" })).toBe(3);
    expect(requests).toHaveLength(0);
    expect(await chain.interpret({ itemIndex: 2, language: "sheng", text: "sijui" })).toBe(3);
    expect(requests).toHaveLength(1);
  });
});

describe("crypto", () => {
  it("encrypts phone numbers so only the key holder can read them", () => {
    const key = Buffer.alloc(32, 7);
    const cipher = new AesGcmCipher(key);
    const sealed = cipher.encrypt("+254712345678");
    expect(sealed).not.toContain("712345678");
    expect(cipher.encrypt("+254712345678")).not.toBe(sealed);
    expect(cipher.decrypt(sealed)).toBe("+254712345678");
    expect(() => new AesGcmCipher(Buffer.alloc(31)).encrypt("x")).toThrow(RangeError);
    expect(() => new AesGcmCipher(Buffer.alloc(32, 8)).decrypt(sealed)).toThrow();
  });

  it("hashes consistently with a secret key", () => {
    const hasher = new HmacHasher(Buffer.alloc(32, 1));
    expect(hasher.hash("+254712345678")).toBe(hasher.hash("+254712345678"));
    expect(new HmacHasher(Buffer.alloc(32, 2)).hash("+254712345678")).not.toBe(
      hasher.hash("+254712345678"),
    );
    expect(() => new HmacHasher(Buffer.alloc(16))).toThrow(RangeError);
  });
});

describe("notifiers", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  it("posts a notice without the phone number", async () => {
    const bodies: string[] = [];
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
      req.on("end", () => {
        bodies.push(raw);
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const notifier = new WebhookNotifier(`http://127.0.0.1:${port}/hook`);
    await notifier.notify({ id: "r1", tier: "urgent", ward: "Kangemi", createdAt: new Date() });
    expect(bodies[0]).toContain("urgent");
    expect(bodies[0]).not.toMatch(/\+254/);
  });

  it("never throws when the webhook is down", async () => {
    const notifier = new WebhookNotifier("http://127.0.0.1:9/unreachable");
    await expect(
      notifier.notify({ id: "r1", tier: "high", ward: null, createdAt: new Date() }),
    ).resolves.toBeUndefined();
    await expect(
      new LogNotifier().notify({ id: "r1", tier: "low", ward: null, createdAt: new Date() }),
    ).resolves.toBeUndefined();
  });
});

describe("config", () => {
  it("explains every problem in one error", () => {
    expect(() => loadConfig({ PUBLIC_BASE_URL: "not a url" })).toThrow(
      /ENCRYPTION_KEY[\s\S]*STAFF_PASSWORD/,
    );
  });

  it("requires a Twilio token in production", () => {
    expect(() => testConfig({ NODE_ENV: "production" })).toThrow(/TWILIO_AUTH_TOKEN/);
  });

  it("never allows demo mode in production", () => {
    expect(() =>
      testConfig({ NODE_ENV: "production", TWILIO_AUTH_TOKEN: "t", DEMO_MODE: "true" }),
    ).toThrow(/DEMO_MODE/);
  });

  it("requires both LLM settings or neither", () => {
    expect(() => testConfig({ LLM_BASE_URL: "http://localhost:8000/v1" })).toThrow(/LLM_MODEL/);
  });

  it("reads areas and thresholds", () => {
    const config = testConfig({ WARDS: " Kangemi , Dagoretti North ,", EPDS_PROBABLE: "12" });
    expect(config.WARDS).toEqual(["Kangemi", "Dagoretti North"]);
    expect(config.EPDS_PROBABLE).toBe(12);
    expect(() => testConfig({ EPDS_POSSIBLE: "14" })).toThrow(/EPDS_POSSIBLE/);
  });
});
