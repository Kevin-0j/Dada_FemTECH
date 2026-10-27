import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidTwilioSignature } from "../../src/adapters/http/twilio-signature.ts";
import { BASE_URL, form, testApp } from "../support/fixtures.ts";

const TOKEN = "twilio-test-auth-token";
const FROM = "whatsapp:+254798765432";

function sign(url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .toSorted()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", TOKEN).update(payload).digest("base64");
}

async function send(app: ReturnType<typeof testApp>["app"], body: string, signed = true) {
  const params = { From: FROM, Body: body, To: "whatsapp:+14155238886" };
  const headers: Record<string, string> = signed
    ? { "x-twilio-signature": sign(`${BASE_URL}/whatsapp`, params) }
    : {};
  const request = form(params);
  const response = await app.request("/whatsapp", {
    method: "POST",
    body: request.body,
    headers: { ...request.headers, ...headers },
  });
  return { status: response.status, text: await response.text() };
}

function message(twiml: string): string {
  return /<Message>([\s\S]*)<\/Message>/.exec(twiml)?.[1] ?? "";
}

describe("POST /whatsapp (Twilio)", () => {
  it("answers in TwiML and understands free-text Sheng answers", async () => {
    const { app } = testApp({ TWILIO_AUTH_TOKEN: TOKEN });
    const first = await send(app, "Habari");
    expect(first.status).toBe(200);
    expect(first.text).toContain('<?xml version="1.0"');
    expect(message(first.text)).toContain("Karibu Dada.");

    await send(app, "1");
    await send(app, "sawa");
    const afterFreeText = await send(app, "kiasi tu");
    // "kiasi tu" answered question 1, so question 2 is shown next.
    expect(message(afterFreeText.text)).toContain("Umekuwa ukingoja vitu kwa furaha?");
  });

  it("goes straight to an urgent offer when someone types about self-harm", async () => {
    const { app } = testApp({ TWILIO_AUTH_TOKEN: TOKEN });
    await send(app, "Habari");
    await send(app, "1");
    const reply = await send(app, "sitaki kuishi tena");
    expect(message(reply.text)).toContain("999");

    await send(app, "1");
    const done = await send(app, "1");
    expect(message(done.text)).toContain("Unaishi area gani?");
  });

  it("starts again from the language menu when someone types anza", async () => {
    const { app } = testApp({ TWILIO_AUTH_TOKEN: TOKEN });
    await send(app, "Habari");
    await send(app, "2");
    const restarted = await send(app, "Anza");
    expect(message(restarted.text)).toContain("Karibu Dada.");
  });

  it("stops replying to a number that sends too many messages", async () => {
    const { app, clock } = testApp({ TWILIO_AUTH_TOKEN: TOKEN, WHATSAPP_PER_MINUTE: "3" });
    for (let i = 0; i < 3; i++) expect(message((await send(app, "1")).text)).not.toBe("");
    const limited = await send(app, "1");
    expect(limited.status).toBe(200);
    expect(limited.text).toContain("<Response></Response>");
    clock.advanceMinutes(1);
    expect(message((await send(app, "1")).text)).not.toBe("");
  });

  it("refuses oversized requests", async () => {
    const { app } = testApp();
    const response = await app.request("/whatsapp", {
      method: "POST",
      ...form({ From: FROM, Body: "x".repeat(20_000) }),
    });
    expect(response.status).toBe(413);
  });

  it("rejects requests with a bad signature", async () => {
    const { app } = testApp({ TWILIO_AUTH_TOKEN: TOKEN });
    const response = await send(app, "Habari", false);
    expect(response.status).toBe(403);
  });

  it("rejects senders that are not WhatsApp numbers", async () => {
    const { app } = testApp();
    const response = await app.request("/whatsapp", {
      method: "POST",
      ...form({ From: "+254700000000", Body: "hi" }),
    });
    expect(response.status).toBe(400);
  });

  it("escapes text so replies are always valid XML", () => {
    expect(isValidTwilioSignature(TOKEN, "https://x", { a: "1" }, "not-base64")).toBe(false);
  });
});
