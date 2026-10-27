import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { bodyLimit } from "hono/body-limit";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import type { ReferralService, ReferralView } from "../../application/referral-service.ts";
import type { ScreeningService } from "../../application/screening-service.ts";
import type { PublicStats, StatsService } from "../../application/stats-service.ts";
import type { Clock, Hasher } from "../../contracts/ports.ts";
import { normalizeKenyanPhone } from "../../domain/phone.ts";
import { escapeHtml, html, page } from "./html.ts";
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
  From: z.string().regex(/^whatsapp:\+\d{6,15}$/),
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

    const phone = parsed.data.From.replace(/^whatsapp:/, "");
    const sessionKey = `wa:${deps.hasher.hash(phone)}`;
    if (!whatsappLimiter.allow(sessionKey)) {
      // An empty response sends nothing back, so a flood cannot turn into a reply loop.
      return c.body(EMPTY_TWIML, 200, { "content-type": "text/xml; charset=utf-8" });
    }
    const reply = await deps.screening.handle({
      channel: "whatsapp",
      sessionKey,
      fromPhone: phone,
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
    return c.html(staffPage(deps.referrals.listOpen(), deps.demoMode));
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

const TIME = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

const FLAG_LABELS: Readonly<Record<string, string>> = {
  self_harm_item: "Thoughts of self-harm",
  not_safe_now: "Not safe right now",
  harm_at_home: "Harm at home",
  danger_phrase_self_harm: "Typed words about self-harm",
  danger_phrase_violence: "Typed words about violence",
};

function staffPage(referrals: readonly ReferralView[], demo: boolean): string {
  const rows = referrals.map(
    (r) =>
      html`<tr>
        <td><span class="tier tier-${r.tier}">${r.tier}</span></td>
        <td>${r.flags.map((flag) => FLAG_LABELS[flag] ?? flag).join(", ") || "None"}</td>
        <td class="num">${r.epdsScore ?? "Not completed"}</td>
        <td>${r.ward ?? "Not given"}</td>
        <td class="num"><a href="tel:${r.phone}">${r.phone}</a></td>
        <td>${r.channel === "ussd" ? "USSD" : "WhatsApp"}</td>
        <td><time datetime="${r.createdAt.toISOString()}">${TIME.format(r.createdAt)}</time></td>
        <td>
          <form method="post" action="/staff/referrals/${r.id}/contacted">
            <button type="submit">Mark contacted</button>
          </form>
        </td>
      </tr>`,
  );
  const table =
    referrals.length === 0
      ? html`<p class="empty">
          No open referrals. New ones appear here as soon as someone asks for a call.
        </p>`
      : html`<div class="table-wrap" tabindex="0" role="region" aria-labelledby="queue-caption">
          <table>
            <caption id="queue-caption">
              Most urgent first, then oldest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Priority</th>
                <th scope="col">Reasons</th>
                <th scope="col">EPDS score</th>
                <th scope="col">Area</th>
                <th scope="col">Phone</th>
                <th scope="col">Channel</th>
                <th scope="col">Received</th>
                <th scope="col"><span class="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>`;
  return page(
    "Referral queue",
    html`<h1>Referral queue</h1>
      <p class="lead">
        Call urgent cases the same day. Do not write down what the person tells you in this system.
        Follow the clinic's safeguarding protocol.
      </p>
      ${table}`,
    demo,
  );
}

function statsPage(stats: PublicStats, demo: boolean): string {
  const hidden = `Under ${stats.suppressionThreshold}`;
  const card = (label: string, n: number | null, whenHidden = hidden) =>
    html`<div class="card">
      <span class="${n === null ? "n n-hidden" : "n"}">${n ?? whenHidden}</span>
      <span class="l">${label}</span>
    </div>`;
  // Largest areas first; people who chose "Other" always last.
  const wards = Object.entries(stats.referrals.byWard).toSorted(([a, x], [b, y]) =>
    a === "Other" ? 1 : b === "Other" ? -1 : (y ?? 0) - (x ?? 0),
  );
  return page(
    "Live numbers",
    html`<h1>Live numbers</h1>
      <p class="lead">
        Anonymised totals, updated in real time. Counts below ${stats.suppressionThreshold} are
        hidden so that nobody can be identified. Last updated
        <time datetime="${stats.generatedAt}">${TIME.format(new Date(stats.generatedAt))}</time>.
      </p>
      <h2>Screenings</h2>
      <div class="grid">
        ${card("Screenings completed", stats.screenings.total)}
        ${card("By USSD", stats.screenings.byChannel.ussd)}
        ${card("By WhatsApp", stats.screenings.byChannel.whatsapp)}
      </div>
      <h2>Result of screening</h2>
      <div class="grid">
        ${card("Urgent, same-day call", stats.screenings.byTier.urgent)}
        ${card("High, counsellor call", stats.screenings.byTier.high)}
        ${card("Moderate, health promoter", stats.screenings.byTier.moderate)}
        ${card("Low, self-care", stats.screenings.byTier.low)}
      </div>
      <h2>Referrals</h2>
      <div class="grid">
        ${card("Asked for a call", stats.referrals.total)}
        ${card("Contacted", stats.referrals.contacted)} ${card("Waiting", stats.referrals.open)}
        ${card("Median hours to contact", stats.referrals.medianHoursToContact, "Not enough data")}
      </div>
      ${
        wards.length === 0
          ? ""
          : html`<h2>Referrals by area</h2>
              <div class="grid">${wards.map(([ward, n]) => card(ward, n))}</div>`
      }
      <p><a href="/stats.json">Download these numbers as JSON</a></p>`,
    demo,
  );
}
