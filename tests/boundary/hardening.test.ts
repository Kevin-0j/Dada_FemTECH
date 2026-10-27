import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../src/adapters/http/rate-limiter.ts";
import { EPDS_ITEMS } from "../../src/domain/epds.ts";
import {
  ManualClock,
  USSD_KEY,
  basicAuthHeader,
  form,
  playUssd,
  testApp,
} from "../support/fixtures.ts";

const answerAll = (score: 0 | 3) =>
  EPDS_ITEMS.map((item, index) =>
    String(item.options.findIndex((o) => o.score === (index === 9 ? 0 : score)) + 1),
  );

describe("request logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs method, path and status but never the query string", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { app } = testApp({ NODE_ENV: "development" });
    await app.request(`/ussd?key=${USSD_KEY}`, {
      method: "POST",
      ...form({ sessionId: "s", serviceCode: "*1#", phoneNumber: "+254712345678", text: "" }),
    });
    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => /^POST \/ussd 200 \d+ms$/.test(line))).toBe(true);
    expect(lines.join("\n")).not.toContain(USSD_KEY);
    expect(lines.join("\n")).not.toContain("712345678");
  });
});

describe("RateLimiter", () => {
  it("resets after the window and forgets old keys", () => {
    const clock = new ManualClock();
    const limiter = new RateLimiter(clock, 1, 60_000);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    for (let i = 0; i < 10_001; i++) limiter.allow(`k${i}`);
    clock.advanceMinutes(2);
    expect(limiter.allow("fresh")).toBe(true);
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("staff queue order", () => {
  it("puts urgent cases above high ones, then the oldest first", async () => {
    const { app, clock } = testApp();
    await playUssd(app, ["3", "1", ...answerAll(3), "2", "1", "1", "1", "1"], "high-1");
    clock.advanceMinutes(5);
    await playUssd(app, ["3", "1", ...answerAll(0), "2", "2", "1", "1", "2"], "urgent-1");
    const page = await (
      await app.request("/staff", { headers: { authorization: basicAuthHeader() } })
    ).text();
    expect(page.indexOf("tier-urgent")).toBeLessThan(page.indexOf("tier-high"));
  });

  it("lists areas by size with Other last on the live numbers page", async () => {
    const { app } = testApp({ STATS_SUPPRESSION: "1" });
    await playUssd(app, ["3", "1", ...answerAll(3), "2", "1", "1", "1", "3"], "o");
    await playUssd(app, ["3", "1", ...answerAll(3), "2", "1", "1", "1", "2"], "d1");
    await playUssd(app, ["3", "1", ...answerAll(3), "2", "1", "1", "1", "2"], "d2");
    await playUssd(app, ["3", "1", ...answerAll(3), "2", "1", "1", "1", "1"], "k");
    const page = await (await app.request("/stats")).text();
    const order = ["Dagoretti", "Kangemi", "Other"].map((ward) => page.lastIndexOf(ward));
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });
});

describe("language model through the whole app", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  it("uses the configured model when the rules cannot place a WhatsApp answer", async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"option": 1}' } }] }));
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const { app } = testApp({
      LLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
      LLM_MODEL: "test-model",
      REFERRAL_WEBHOOK_URL: `http://127.0.0.1:${port}/hook`,
    });
    const send = async (body: string) =>
      (
        await app.request("/whatsapp", {
          method: "POST",
          ...form({ From: "whatsapp:+254711000222", Body: body }),
        })
      ).text();
    await send("Habari");
    await send("3");
    await send("1");
    const reply = await send("I laugh like I always used to with my friends");
    expect(reply).toContain("Have you looked forward with enjoyment to things?");
  });
});
