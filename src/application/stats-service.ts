import { CHANNELS, type CaseRepository, type Channel } from "../contracts/ports.ts";
import { RISK_TIERS, type RiskTier } from "../domain/risk.ts";

/**
 * Public, anonymised numbers for the real-time dashboard UNICEF asks investees to publish.
 * Any count below the suppression threshold is reported as null so that small groups cannot be
 * re-identified.
 */
export interface PublicStats {
  readonly generatedAt: string;
  readonly suppressionThreshold: number;
  readonly screenings: {
    readonly total: number;
    readonly byTier: Readonly<Record<RiskTier, number | null>>;
    readonly byChannel: Readonly<Record<Channel, number | null>>;
    /** Screenings per day for the last 14 days in Nairobi time, oldest first. */
    readonly daily: ReadonlyArray<{ readonly date: string; readonly count: number | null }>;
  };
  readonly referrals: {
    readonly total: number;
    readonly contacted: number | null;
    readonly open: number | null;
    readonly byWard: Readonly<Record<string, number | null>>;
    /** Median hours from referral to first contact, over contacted referrals. */
    readonly medianHoursToContact: number | null;
  };
}

export interface StatsServiceDeps {
  readonly cases: CaseRepository;
  readonly now: () => Date;
  readonly suppressionThreshold: number;
}

export class StatsService {
  readonly #deps: StatsServiceDeps;

  constructor(deps: StatsServiceDeps) {
    this.#deps = deps;
  }

  publicStats(): PublicStats {
    const { cases, now, suppressionThreshold } = this.#deps;
    const suppress = (count: number): number | null =>
      count < suppressionThreshold ? null : count;

    const screenings = cases.listScreenings();
    const referrals = cases.listReferrals();
    const contacted = referrals.filter((referral) => referral.contactedAt !== null);

    const byTier = Object.fromEntries(
      RISK_TIERS.map((tier) => [tier, suppress(screenings.filter((s) => s.tier === tier).length)]),
    ) as Record<RiskTier, number | null>;
    const byChannel = Object.fromEntries(
      CHANNELS.map((channel) => [
        channel,
        suppress(screenings.filter((s) => s.channel === channel).length),
      ]),
    ) as Record<Channel, number | null>;

    const perDay = new Map<string, number>();
    for (const screening of screenings) {
      const day = nairobiDate(screening.completedAt);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const daily = Array.from({ length: DAYS_SHOWN }, (_, index) => {
      const date = nairobiDate(new Date(now().getTime() - (DAYS_SHOWN - 1 - index) * DAY_MS));
      return { date, count: suppress(perDay.get(date) ?? 0) };
    });

    const wardCounts = new Map<string, number>();
    for (const referral of referrals) {
      const ward = referral.ward ?? "Other";
      wardCounts.set(ward, (wardCounts.get(ward) ?? 0) + 1);
    }

    const hoursToContact = contacted.map(
      (referral) =>
        ((referral.contactedAt?.getTime() ?? 0) - referral.createdAt.getTime()) / 3_600_000,
    );

    return {
      generatedAt: now().toISOString(),
      suppressionThreshold,
      screenings: { total: screenings.length, byTier, byChannel, daily },
      referrals: {
        total: referrals.length,
        contacted: suppress(contacted.length),
        open: suppress(referrals.length - contacted.length),
        byWard: Object.fromEntries([...wardCounts].map(([ward, count]) => [ward, suppress(count)])),
        medianHoursToContact:
          contacted.length < suppressionThreshold ? null : round1(median(hoursToContact)),
      },
    };
  }
}

const DAYS_SHOWN = 14;
const DAY_MS = 24 * 3_600_000;
const NAIROBI_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" });

/** YYYY-MM-DD in Nairobi time, so a day starts at local midnight. */
function nairobiDate(date: Date): string {
  return NAIROBI_DAY.format(date);
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[middle - 1] ?? 0) + upper) / 2;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
