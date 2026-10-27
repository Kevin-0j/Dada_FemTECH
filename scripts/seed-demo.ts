/**
 * Fills the database with fictional screenings and referrals so the staff queue and the live
 * numbers page have something to show in a demo. Every phone number is a made-up test number.
 *
 *   npm run seed:demo
 *
 * Only runs when DEMO_MODE=true, which also shows a "demo data" banner on every page.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { AesGcmCipher } from "../src/adapters/crypto/node-crypto.ts";
import { SqliteCaseRepository } from "../src/adapters/storage/sqlite-case-repository.ts";
import { loadConfig } from "../src/config.ts";
import type { Channel } from "../src/contracts/ports.ts";
import type { RiskTier } from "../src/domain/risk.ts";
import type { Flag } from "../src/domain/screening.ts";

const config = loadConfig(process.env);
if (!config.DEMO_MODE) {
  console.error(
    "Set DEMO_MODE=true to add fictional demo data. Never do this on a real deployment.",
  );
  process.exit(1);
}
if (config.DATABASE_PATH !== ":memory:")
  mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });

const cases = new SqliteCaseRepository(config.DATABASE_PATH);
const cipher = new AesGcmCipher(config.ENCRYPTION_KEY);
const wards = [...config.WARDS, null];

// A fixed seed keeps the demo numbers the same every time.
let seed = 20261104;
const random = (): number => {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
};
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

const TIERS: ReadonlyArray<readonly [RiskTier, number, number, number]> = [
  // tier, share of screenings, lowest and highest EPDS score that fits the tier
  ["low", 0.52, 0, 9],
  ["moderate", 0.22, 10, 12],
  ["high", 0.19, 13, 24],
  ["urgent", 0.07, 6, 24],
];

function tierFor(roll: number): (typeof TIERS)[number] {
  let total = 0;
  for (const tier of TIERS) {
    total += tier[1];
    if (roll < total) return tier;
  }
  return TIERS[0] as (typeof TIERS)[number];
}

const now = Date.now();
let screenings = 0;
let referrals = 0;

for (let i = 0; i < 140; i++) {
  const [tier, , lowest, highest] = tierFor(random());
  const completedAt = new Date(now - random() * 14 * 24 * 3_600_000);
  const channel: Channel = random() < 0.68 ? "ussd" : "whatsapp";
  const epdsScore = lowest + Math.floor(random() * (highest - lowest + 1));
  cases.recordScreening({ id: randomUUID(), completedAt, channel, tier, epdsScore });
  screenings++;

  const asksForCall = tier === "low" ? random() < 0.08 : random() < 0.8;
  if (!asksForCall) continue;

  const flags: Flag[] = [];
  if (tier === "urgent") flags.push(random() < 0.6 ? "self_harm_item" : "not_safe_now");
  if (tier === "high" && random() < 0.3) flags.push("harm_at_home");

  const hoursToContact = tier === "urgent" ? 0.5 + random() * 3 : 2 + random() * 40;
  const contactedAt = new Date(completedAt.getTime() + hoursToContact * 3_600_000);
  const stillOpen = contactedAt.getTime() > now || random() < 0.06;

  cases.createReferral({
    id: randomUUID(),
    createdAt: completedAt,
    channel,
    tier,
    epdsScore,
    flags,
    ward: pick(wards),
    phoneCiphertext: cipher.encrypt(`+2547000${String(100 + i).padStart(5, "0")}`),
    status: stillOpen ? "open" : "contacted",
    contactedAt: stillOpen ? null : contactedAt,
  });
  referrals++;
}

cases.close();
console.info(`Added ${screenings} fictional screenings and ${referrals} referrals.`);
