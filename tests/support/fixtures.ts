import { randomBytes } from "node:crypto";
import { compose, type ComposeOptions } from "../../src/compose.ts";
import { loadConfig, type Config } from "../../src/config.ts";
import type { Clock } from "../../src/contracts/ports.ts";

export const STAFF_USER = "counsellor";
export const STAFF_PASSWORD = "correct-horse-battery";
export const USSD_KEY = "test-ussd-callback-key";
export const BASE_URL = "https://dada.example.org";

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    PUBLIC_BASE_URL: BASE_URL,
    DATABASE_PATH: ":memory:",
    ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    HASH_KEY: randomBytes(32).toString("base64"),
    USSD_CALLBACK_KEY: USSD_KEY,
    STAFF_USER,
    STAFF_PASSWORD,
    STATS_SUPPRESSION: "1",
    ...overrides,
  });
}

/** A clock tests can move forward. */
export class ManualClock implements Clock {
  #now: Date;

  constructor(start = new Date("2026-11-01T08:00:00Z")) {
    this.#now = start;
  }

  now(): Date {
    return new Date(this.#now);
  }

  advanceMinutes(minutes: number): void {
    this.#now = new Date(this.#now.getTime() + minutes * 60_000);
  }
}

export function testApp(overrides: Record<string, string> = {}, options: ComposeOptions = {}) {
  const clock = options.clock instanceof ManualClock ? options.clock : new ManualClock();
  const composition = compose(testConfig(overrides), { ...options, clock });
  return { ...composition, clock };
}

export function form(fields: Record<string, string>): {
  body: URLSearchParams;
  headers: Record<string, string>;
} {
  return {
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  };
}

export function basicAuthHeader(user = STAFF_USER, password = STAFF_PASSWORD): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

/**
 * Plays a USSD session the way Africa's Talking does: every request carries all answers so far,
 * joined by "*". Returns each screen the phone would show.
 */
export async function playUssd(
  app: { request: (path: string, init: RequestInit) => Response | Promise<Response> },
  answers: readonly string[],
  sessionId = "ATUid_test_session",
  phoneNumber = "+254712345678",
): Promise<string[]> {
  const screens: string[] = [];
  for (let i = 0; i <= answers.length; i++) {
    const response = await app.request(`/ussd?key=${USSD_KEY}`, {
      method: "POST",
      ...form({
        sessionId,
        serviceCode: "*384*123#",
        phoneNumber,
        text: answers.slice(0, i).join("*"),
      }),
    });
    screens.push(await response.text());
  }
  return screens;
}
