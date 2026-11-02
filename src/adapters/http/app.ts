import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { bodyLimit } from "hono/body-limit";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import type { ReferralService } from "../../application/referral-service.ts";
import type { ScreeningService } from "../../application/screening-service.ts";
import type { StatsService } from "../../application/stats-service.ts";
import type { Clock, Hasher } from "../../contracts/ports.ts";
import { normalizeKenyanPhone } from "../../domain/phone.ts";
import { escapeHtml } from "./html.ts";
import { staffPage, statsPage } from "./pages.ts";
import { RateLimiter } from "./rate-limiter.ts";
import { isValidTwilioSignature } from "./twilio-signature.ts";

export interface HttpDeps {
  readonly screening: ScreeningService;
  readonly referrals: ReferralService;
  readonly stats: StatsService;
  readonly hasher: Hasher;
  /** Shared secret Africa's Talking sends as ?key=... on the callback URL. */
  readonly ussdCallbackKey: string;
  /** Twilio auth token. When null, signatures are not checked (local development only). */
  readonly twilioAuthToken: string | null;
  /** Public base URL, needed to rebuild the URL Twilio signed. */
  readonly publicBaseUrl: string;
  readonly staffUser: string;
  readonly staffPassword: string;
  readonly clock: Clock;
  /** Most WhatsApp messages one number may send per minute. */
  readonly whatsappPerMinute: number;
  /** Turn off for tests. */
  readonly logRequests: boolean;
  /** Shows a "demo data" banner on every page. */
  readonly demoMode: boolean;
  /** Shown to staff so they know when phone numbers are deleted. */
  readonly retentionDays: number;
}

/** Larger than any real USSD or WhatsApp request; stops oversized bodies early. */
const MAX_BODY_BYTES = 16 * 1024;

const ussdRequest = z.object({
  sessionId: z.string().min(1).max(200),
  serviceCode: z.string().max(50),
  phoneNumber: z.string().min(1).max(20),
  text: z.string().max(500).default(""),
});

const whatsappRequest = z.object({
  // A phone number, or a business-scoped user id such as "KE.12ab..." when the user hides their
  // number behind a WhatsApp username.
  From: z.string().regex(/^whatsapp:(\+\d{6,15}|[A-Z]{2}\.[A-Za-z0-9]{1,128})$/),
  Body: z.string().max(1600).default(""),
});

export function createApp(deps: HttpDeps): Hono {
  const app = new Hono();
  const whatsappLimiter = new RateLimiter(deps.clock, deps.whatsappPerMinute, 60_000);

  if (deps.logRequests) {
    // Logs the path only: query strings can hold the USSD key, and bodies hold what people type.
    app.use(async (c, next) => {
      const started = performance.now();
      await next();
      const ms = Math.round(performance.now() - started);
      console.info(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
    });
  }
  app.use(secureHeaders());
  app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.text("Payload too large", 413) }));

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/ussd", async (c) => {
    if (!safeEqual(c.req.query("key") ?? "", deps.ussdCallbackKey)) {
      return c.text("Forbidden", 403);
    }
    const parsed = ussdRequest.safeParse(await c.req.parseBody());
    if (!parsed.success) return c.text("END Request not understood.", 400);

    // Africa's Talking sends every answer so far joined by "*"; we only need the latest one.
    const latest = parsed.data.text === "" ? "" : (parsed.data.text.split("*").at(-1) ?? "");
    const reply = await deps.screening.handle({
      channel: "ussd",
      sessionKey: `ussd:${deps.hasher.hash(parsed.data.sessionId)}`,
      fromPhone: normalizeKenyanPhone(parsed.data.phoneNumber) ?? parsed.data.phoneNumber,
      text: latest,
    });
    return c.text(`${reply.ended ? "END" : "CON"} ${reply.text}`);
  });

  app.post("/whatsapp", async (c) => {
    const body = await c.req.parseBody();
    const params = Object.fromEntries(
      Object.entries(body).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    if (deps.twilioAuthToken !== null) {
      const url = new URL(c.req.path, deps.publicBaseUrl).toString();
      const signature = c.req.header("x-twilio-signature") ?? "";
      if (!isValidTwilioSignature(deps.twilioAuthToken, url, params, signature)) {
        return c.text("Forbidden", 403);
      }
    }
    const parsed = whatsappRequest.safeParse(params);
    if (!parsed.success) return c.text("Bad request", 400);

    const sender = parsed.data.From.replace(/^whatsapp:/, "");
    const sessionKey = `wa:${deps.hasher.hash(sender)}`;
    if (!whatsappLimiter.allow(sessionKey)) {
      // An empty response sends nothing back, so a flood cannot turn into a reply loop.
      return c.body(EMPTY_TWIML, 200, { "content-type": "text/xml; charset=utf-8" });
    }
    const reply = await deps.screening.handle({
      channel: "whatsapp",
      sessionKey,
      fromPhone: sender.startsWith("+") ? sender : null,
      text: parsed.data.Body,
    });
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeHtml(reply.text)}</Message></Response>`;
    return c.body(twiml, 200, { "content-type": "text/xml; charset=utf-8" });
  });

  app.get("/stats.json", (c) => {
    c.header("cache-control", "public, max-age=60");
    return c.json(deps.stats.publicStats());
  });
  app.get("/stats", (c) => c.html(statsPage(deps.stats.publicStats(), deps.demoMode)));
  app.get("/", (c) => c.redirect("/stats"));

  const staff = new Hono();
  staff.use(basicAuth({ username: deps.staffUser, password: deps.staffPassword }));
  staff.use(csrf());
  staff.get("/", (c) => {
    c.header("cache-control", "no-store");
    return c.html(
      staffPage(deps.referrals.listOpen(), {
        now: deps.clock.now(),
        demo: deps.demoMode,
        retentionDays: deps.retentionDays,
      }),
    );
  });
  staff.post("/referrals/:id/contacted", (c) => {
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) return c.text("Not found", 404);
    deps.referrals.markContacted(id);
    return c.redirect("/staff", 303);
  });
  app.route("/staff", staff);

  return app;
}

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
