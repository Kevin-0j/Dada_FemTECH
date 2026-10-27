import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  CHANNELS,
  REFERRAL_STATUSES,
  type CaseRepository,
  type Referral,
  type ScreeningRecord,
} from "../../contracts/ports.ts";
import { RISK_TIERS } from "../../domain/risk.ts";
import type { Flag } from "../../domain/screening.ts";

const FLAGS = [
  "self_harm_item",
  "not_safe_now",
  "harm_at_home",
  "danger_phrase_self_harm",
  "danger_phrase_violence",
] as const satisfies readonly Flag[];

const screeningRow = z.object({
  id: z.string(),
  completed_at: z.string(),
  channel: z.enum(CHANNELS),
  tier: z.enum(RISK_TIERS),
  epds_score: z.number().int().nullable(),
});

const referralRow = z.object({
  id: z.string(),
  created_at: z.string(),
  channel: z.enum(CHANNELS),
  tier: z.enum(RISK_TIERS),
  epds_score: z.number().int().nullable(),
  flags: z.string(),
  ward: z.string().nullable(),
  phone_ciphertext: z.string(),
  status: z.enum(REFERRAL_STATUSES),
  contacted_at: z.string().nullable(),
});

const flagList = z.array(z.enum(FLAGS));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS screenings (
  id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL,
  channel TEXT NOT NULL,
  tier TEXT NOT NULL,
  epds_score INTEGER
);
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  channel TEXT NOT NULL,
  tier TEXT NOT NULL,
  epds_score INTEGER,
  flags TEXT NOT NULL,
  ward TEXT,
  phone_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL,
  contacted_at TEXT
);
CREATE INDEX IF NOT EXISTS referrals_status ON referrals (status);
`;

/** Case storage on SQLite, using Node's built-in driver. Pass ":memory:" for tests. */
export class SqliteCaseRepository implements CaseRepository {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec("PRAGMA journal_mode = WAL;");
    this.#db.exec(SCHEMA);
  }

  recordScreening(record: ScreeningRecord): void {
    this.#db
      .prepare(
        "INSERT INTO screenings (id, completed_at, channel, tier, epds_score) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        record.completedAt.toISOString(),
        record.channel,
        record.tier,
        record.epdsScore,
      );
  }

  createReferral(referral: Referral): void {
    this.#db
      .prepare(
        `INSERT INTO referrals
          (id, created_at, channel, tier, epds_score, flags, ward, phone_ciphertext, status, contacted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        referral.id,
        referral.createdAt.toISOString(),
        referral.channel,
        referral.tier,
        referral.epdsScore,
        JSON.stringify(referral.flags),
        referral.ward,
        referral.phoneCiphertext,
        referral.status,
        referral.contactedAt?.toISOString() ?? null,
      );
  }

  listOpenReferrals(): readonly Referral[] {
    return this.#db.prepare("SELECT * FROM referrals WHERE status = 'open'").all().map(toReferral);
  }

  listReferrals(): readonly Referral[] {
    return this.#db.prepare("SELECT * FROM referrals").all().map(toReferral);
  }

  listScreenings(): readonly ScreeningRecord[] {
    return this.#db
      .prepare("SELECT * FROM screenings")
      .all()
      .map((row) => {
        const parsed = screeningRow.parse(row);
        return {
          id: parsed.id,
          completedAt: new Date(parsed.completed_at),
          channel: parsed.channel,
          tier: parsed.tier,
          epdsScore: parsed.epds_score,
        };
      });
  }

  markContacted(id: string, at: Date): boolean {
    const result = this.#db
      .prepare(
        "UPDATE referrals SET status = 'contacted', contacted_at = ? WHERE id = ? AND status = 'open'",
      )
      .run(at.toISOString(), id);
    return Number(result.changes) === 1;
  }

  purgeContactedBefore(cutoff: Date): number {
    const result = this.#db
      .prepare("DELETE FROM referrals WHERE status = 'contacted' AND contacted_at < ?")
      .run(cutoff.toISOString());
    return Number(result.changes);
  }

  close(): void {
    this.#db.close();
  }
}

function toReferral(row: unknown): Referral {
  const parsed = referralRow.parse(row);
  return {
    id: parsed.id,
    createdAt: new Date(parsed.created_at),
    channel: parsed.channel,
    tier: parsed.tier,
    epdsScore: parsed.epds_score,
    flags: flagList.parse(JSON.parse(parsed.flags)),
    ward: parsed.ward,
    phoneCiphertext: parsed.phone_ciphertext,
    status: parsed.status,
    contactedAt: parsed.contacted_at === null ? null : new Date(parsed.contacted_at),
  };
}
