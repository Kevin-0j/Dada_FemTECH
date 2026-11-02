import type { ReferralView } from "../../application/referral-service.ts";
import type { PublicStats } from "../../application/stats-service.ts";
import type { RiskTier } from "../../domain/risk.ts";
import { html, page, type SafeHtml } from "./html.ts";

const TIME = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});
const DAY = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
/** Formats a YYYY-MM-DD day as "2 Nov". */
const dayLabel = (iso: string): string => DAY.format(new Date(`${iso}T00:00:00Z`));
const WEEKDAY = new Intl.DateTimeFormat("en-KE", { weekday: "short", timeZone: "UTC" });

const FLAG_LABELS: Readonly<Record<string, string>> = {
  self_harm_item: "Thoughts of self-harm",
  not_safe_now: "Not safe right now",
  harm_at_home: "Harm at home",
  danger_phrase_self_harm: "Typed words about self-harm",
  danger_phrase_violence: "Typed words about violence",
};

const TIER_LABELS: Readonly<Record<RiskTier, string>> = {
  urgent: "Urgent",
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

/**
 * Hours within which each level should get a first call. The urgent target follows the
 * suggestion in SAFEGUARDING.md; the clinical lead agrees the final numbers before launch.
 */
const RESPONSE_TARGET_HOURS: Readonly<Record<RiskTier, number>> = {
  urgent: 2,
  high: 24,
  moderate: 72,
  low: 72,
};

const TIER_MEANING: Readonly<Record<RiskTier, string>> = {
  urgent: "Thoughts of self-harm, or not safe right now. A counsellor calls the same day.",
  high: "EPDS 13 or more, or harm at home. A counsellor calls.",
  moderate: "EPDS 10 to 12. A community health promoter follows up.",
  low: "EPDS under 10. Self-care tips and how to come back.",
};

function tierBadge(tier: RiskTier): SafeHtml {
  return html`<span class="badge badge-${tier}">${TIER_LABELS[tier]}</span>`;
}

function formatWait(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.floor(hours)} h ${Math.round((hours % 1) * 60)} min`;
  return `${Math.floor(hours / 24)} days`;
}

export interface StaffPageOptions {
  readonly now: Date;
  readonly demo: boolean;
  readonly retentionDays: number;
}

export function staffPage(
  referrals: readonly ReferralView[],
  { now, demo, retentionDays }: StaffPageOptions,
): string {
  const waitHours = (r: ReferralView) => (now.getTime() - r.createdAt.getTime()) / 3_600_000;
  const overdue = referrals.filter((r) => waitHours(r) > RESPONSE_TARGET_HOURS[r.tier]);
  const count = (tier: RiskTier) => referrals.filter((r) => r.tier === tier).length;
  const oldest = referrals.reduce((max, r) => Math.max(max, waitHours(r)), 0);

  const rows = referrals.map((r) => {
    const hours = waitHours(r);
    const late = hours > RESPONSE_TARGET_HOURS[r.tier];
    return html`<tr class="${late ? "late" : ""}">
      <td data-label="Priority">${tierBadge(r.tier)}</td>
      <td data-label="Reasons">
        ${r.flags.map((flag) => FLAG_LABELS[flag] ?? flag).join(", ") || "None"}
      </td>
      <td class="num" data-label="EPDS score">${r.epdsScore ?? "Not completed"}</td>
      <td data-label="Area">${r.ward ?? "Not given"}</td>
      <td class="num" data-label="Phone"><a href="tel:${r.phone}">${r.phone}</a></td>
      <td data-label="Channel">${r.channel === "ussd" ? "USSD" : "WhatsApp"}</td>
      <td data-label="Received">
        <time datetime="${r.createdAt.toISOString()}">${TIME.format(r.createdAt)}</time>
        <span class="wait">
          Waiting ${formatWait(hours)}${late ? html`, <strong>past target</strong>` : ""}
        </span>
      </td>
      <td class="action">
        <form method="post" action="/staff/referrals/${r.id}/contacted">
          <button type="submit">Mark contacted</button>
        </form>
      </td>
    </tr>`;
  });

  const summary = html`<div class="grid">
    <div class="card ${count("urgent") > 0 ? "card-alert" : ""}">
      <span class="n">${count("urgent")}</span><span class="l">Urgent, call today</span>
    </div>
    <div class="card"><span class="n">${count("high")}</span><span class="l">High</span></div>
    <div class="card">
      <span class="n">${referrals.length}</span><span class="l">Waiting in total</span>
    </div>
    <div class="card ${overdue.length > 0 ? "card-alert" : ""}">
      <span class="n">${overdue.length}</span><span class="l">Past response target</span>
    </div>
    <div class="card">
      <span class="n n-small">${referrals.length === 0 ? "None" : formatWait(oldest)}</span>
      <span class="l">Longest wait</span>
    </div>
  </div>`;

  const table =
    referrals.length === 0
      ? html`<p class="empty">
          No open referrals. New ones appear here as soon as someone asks for a call.
        </p>`
      : html`<div class="table-wrap" tabindex="0" role="region" aria-labelledby="queue-caption">
          <table class="queue">
            <caption id="queue-caption">
              Most urgent first, then oldest first. Rows past their response target are marked.
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
        Women who finished a screening and asked for a call back. Call urgent cases first. Do not
        write down what the person tells you in this system; follow the clinic's safeguarding
        protocol.
      </p>
      ${summary}
      <h2>Waiting for a call</h2>
      ${table}
      <h2>Before you call</h2>
      <div class="two-col">
        <details open>
          <summary>How to start the call</summary>
          <p class="hint">
            A suggested opening. Follow the clinic's own protocol where it differs.
          </p>
          <ol>
            <li>
              Say your first name and that you are calling from the clinic. Do not say "Dada".
            </li>
            <li>Ask: "Is this a good time, and are you somewhere you can talk?"</li>
            <li>If she cannot talk, agree a safer time and end the call politely.</li>
            <li>
              If someone else answers, give no reason for the call and say you will try later.
            </li>
          </ol>
        </details>
        <details open>
          <summary>Response targets</summary>
          <table class="compact">
            <caption class="visually-hidden">
              Response target for each level
            </caption>
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">First call within</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              ${(["urgent", "high", "moderate"] as const).map(
                (tier) =>
                  html`<tr>
                    <td>${tierBadge(tier)}</td>
                    <td class="num">${RESPONSE_TARGET_HOURS[tier]} hours</td>
                    <td>${TIER_MEANING[tier]}</td>
                  </tr>`,
              )}
            </tbody>
          </table>
        </details>
      </div>
      <p class="note">
        Emergency: 999 or 112. National GBV helpline: 1195, free and open 24 hours. Phone numbers
        are deleted ${retentionDays} days after contact.
      </p>`,
    { demo, current: "staff" },
  );
}

export function statsPage(stats: PublicStats, demo: boolean): string {
  const threshold = stats.suppressionThreshold;
  const hidden = `Under ${threshold}`;
  const { screenings, referrals } = stats;

  const kpi = (label: string, n: number | string | null, note: string, whenHidden = hidden) =>
    html`<div class="card">
      <span class="${n === null ? "n n-hidden" : "n"}">${n ?? whenHidden}</span>
      <span class="l">${label}</span>
      <span class="sub">${note}</span>
    </div>`;

  const shares = (entries: ReadonlyArray<readonly [string, number | null, string]>) => {
    const visible = entries.reduce((sum, [, n]) => sum + (n ?? 0), 0);
    return html`<ul class="bars">
      ${entries.map(([label, n, cls]) => {
        const pct = n === null || visible === 0 ? 0 : Math.round((n / visible) * 100);
        return html`<li>
          <span class="bar-label">${label}</span>
          <span class="track" aria-hidden="true"
            ><span class="fill ${cls}" style="width:${pct}%"></span
          ></span>
          <span class="bar-value"
            >${n === null ? hidden : html`${n} <small>(${pct}%)</small>`}</span
          >
        </li>`;
      })}
    </ul>`;
  };

  const contactRate =
    referrals.contacted === null || referrals.total === 0
      ? null
      : Math.round((referrals.contacted / referrals.total) * 100);

  // Largest areas first; people who chose "Other" always last.
  const wards = Object.entries(referrals.byWard).toSorted(([a, x], [b, y]) =>
    a === "Other" ? 1 : b === "Other" ? -1 : (y ?? 0) - (x ?? 0),
  );

  const peak = Math.max(1, ...screenings.daily.map((d) => d.count ?? 0));
  const trend = html`<figure class="trend">
    <div class="columns" aria-hidden="true">
      ${screenings.daily.map(
        (d) =>
          html`<div class="col">
            <span class="col-value">${d.count ?? "<" + threshold}</span>
            <span
              class="${d.count === null ? "col-bar col-hidden" : "col-bar"}"
              style="height:${d.count === null ? 6 : Math.max(2, (d.count / peak) * 100)}%"
            ></span>
            <span class="col-day">${WEEKDAY.format(new Date(`${d.date}T00:00:00Z`))}</span>
          </div>`,
      )}
    </div>
    <figcaption>
      Screenings completed each day, ${dayLabel(screenings.daily[0]?.date ?? "")} to
      ${dayLabel(screenings.daily.at(-1)?.date ?? "")}. Days with fewer than ${threshold} are shown
      as hidden.
    </figcaption>
    <table class="visually-hidden">
      <caption>
        Screenings per day
      </caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Screenings</th>
        </tr>
      </thead>
      <tbody>
        ${screenings.daily.map(
          (d) =>
            html`<tr>
              <td>${dayLabel(d.date)}</td>
              <td>${d.count ?? hidden}</td>
            </tr>`,
        )}
      </tbody>
    </table>
  </figure>`;

  return page(
    "Live numbers",
    html`<h1>Live numbers</h1>
      <p class="lead">
        Dada screens pregnant women and new mothers in Nairobi for depression and safety risks over
        USSD and WhatsApp, and connects those who want help to a counsellor at VIPS Health Services
        or a community health promoter. These anonymised numbers update in real time. Last updated
        <time datetime="${stats.generatedAt}">${TIME.format(new Date(stats.generatedAt))}</time>.
      </p>

      <h2>At a glance</h2>
      <div class="grid">
        ${kpi("Screenings completed", screenings.total, "All time, both channels")}
        ${kpi("Asked for a call", referrals.total, "Women who chose to be contacted")}
        ${kpi(
          "Reached by a person",
          contactRate === null ? null : `${contactRate}%`,
          "Share of call requests followed up",
          "Not enough data",
        )}
        ${kpi(
          "Median hours to first call",
          referrals.medianHoursToContact,
          "From request to contact",
          "Not enough data",
        )}
      </div>

      <h2>Screenings over the last 14 days</h2>
      ${trend}

      <div class="two-col">
        <section aria-labelledby="levels">
          <h2 id="levels">Result of screening</h2>
          ${shares([
            ["Urgent", screenings.byTier.urgent, "fill-urgent"],
            ["High", screenings.byTier.high, "fill-high"],
            ["Moderate", screenings.byTier.moderate, "fill-moderate"],
            ["Low", screenings.byTier.low, "fill-low"],
          ])}
        </section>
        <section aria-labelledby="channels">
          <h2 id="channels">How women reached Dada</h2>
          ${shares([
            ["USSD (any phone)", screenings.byChannel.ussd, "fill-accent"],
            ["WhatsApp", screenings.byChannel.whatsapp, "fill-accent"],
          ])}
          <h2>Follow-up</h2>
          ${shares([
            ["Contacted", referrals.contacted, "fill-accent"],
            ["Still waiting", referrals.open, "fill-muted"],
          ])}
        </section>
      </div>

      ${
        wards.length === 0
          ? ""
          : html`<h2>Call requests by area</h2>
              ${shares(wards.map(([ward, n]) => [ward, n, "fill-accent"] as const))}`
      }

      <h2>What the levels mean</h2>
      <dl class="levels">
        ${(["urgent", "high", "moderate", "low"] as const).map(
          (tier) =>
            html`<div>
              <dt>${tierBadge(tier)}</dt>
              <dd>${TIER_MEANING[tier]}</dd>
            </div>`,
        )}
      </dl>

      <h2>About these numbers</h2>
      <p class="note">
        Screening uses the Edinburgh Postnatal Depression Scale (EPDS) plus two safety questions.
        Dada keeps only the level and the score, never the answers. A phone number is stored,
        encrypted, only when a woman asks for a call. Any count below ${threshold} is hidden so that
        nobody can be identified. Percentages are of the counts shown.
        <a href="/stats.json">Download these numbers as JSON</a>.
      </p>`,
    { demo, current: "stats" },
  );
}
