import type { Hono } from "hono";
import { ReferralService } from "./application/referral-service.ts";
import { ScreeningService } from "./application/screening-service.ts";
import { StatsService } from "./application/stats-service.ts";
import { AesGcmCipher, HmacHasher } from "./adapters/crypto/node-crypto.ts";
import { createApp } from "./adapters/http/app.ts";
import { ChainInterpreter, LlmInterpreter } from "./adapters/interpreter/llm-interpreter.ts";
import { RuleBasedInterpreter } from "./adapters/interpreter/rule-based-interpreter.ts";
import { LogNotifier, WebhookNotifier } from "./adapters/notify/notifiers.ts";
import { MemorySessionStore } from "./adapters/storage/memory-session-store.ts";
import { SqliteCaseRepository } from "./adapters/storage/sqlite-case-repository.ts";
import type { Config } from "./config.ts";
import type { AnswerInterpreter, Clock } from "./contracts/ports.ts";

export interface Composition {
  readonly app: Hono;
  readonly referrals: ReferralService;
  readonly cases: SqliteCaseRepository;
}

export interface ComposeOptions {
  readonly clock?: Clock;
  readonly fetch?: typeof fetch;
}

/** Wires adapters to the application. The only module that knows about every layer. */
export function compose(config: Config, options: ComposeOptions = {}): Composition {
  const clock: Clock = options.clock ?? { now: () => new Date() };
  const cases = new SqliteCaseRepository(config.DATABASE_PATH);
  const cipher = new AesGcmCipher(config.ENCRYPTION_KEY);
  const hasher = new HmacHasher(config.HASH_KEY);

  const interpreters: AnswerInterpreter[] = [new RuleBasedInterpreter()];
  if (config.LLM_BASE_URL !== null && config.LLM_MODEL !== null) {
    interpreters.push(
      new LlmInterpreter({
        baseUrl: config.LLM_BASE_URL,
        model: config.LLM_MODEL,
        apiKey: config.LLM_API_KEY,
        timeoutMs: config.LLM_TIMEOUT_MS,
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      }),
    );
  }

  const screening = new ScreeningService({
    sessions: new MemorySessionStore(clock, config.SESSION_TTL_MINUTES * 60_000),
    cases,
    cipher,
    clock,
    notifier:
      config.REFERRAL_WEBHOOK_URL === null
        ? new LogNotifier()
        : new WebhookNotifier(config.REFERRAL_WEBHOOK_URL, options.fetch),
    interpreter: new ChainInterpreter(interpreters),
    context: {
      thresholds: {
        possibleDepression: config.EPDS_POSSIBLE,
        probableDepression: config.EPDS_PROBABLE,
      },
      wards: config.WARDS,
    },
  });
  const referrals = new ReferralService({
    cases,
    cipher,
    clock,
    retentionDays: config.RETENTION_DAYS,
  });
  const stats = new StatsService({
    cases,
    now: () => clock.now(),
    suppressionThreshold: config.STATS_SUPPRESSION,
  });

  const app = createApp({
    screening,
    referrals,
    stats,
    hasher,
    ussdCallbackKey: config.USSD_CALLBACK_KEY,
    twilioAuthToken: config.TWILIO_AUTH_TOKEN,
    publicBaseUrl: config.PUBLIC_BASE_URL,
    staffUser: config.STAFF_USER,
    staffPassword: config.STAFF_PASSWORD,
  });
  return { app, referrals, cases };
}
