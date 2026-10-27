import type { Language } from "../domain/language.ts";
import type { RiskTier } from "../domain/risk.ts";
import type { Flag, Session } from "../domain/screening.ts";

/**
 * Interfaces the application layer depends on. Adapters in src/adapters implement them. Nothing
 * here may import from adapters.
 */

export const CHANNELS = ["ussd", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Clock {
  now(): Date;
}

/** Short-lived conversation state. Sessions are never written to disk. */
export interface SessionStore {
  get(key: string): Session | undefined;
  set(key: string, session: Session): void;
  delete(key: string): void;
}

/** Encrypts phone numbers that counsellors need to read back. */
export interface Cipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

/** One-way, keyed hash used to key WhatsApp sessions without storing the number. */
export interface Hasher {
  hash(value: string): string;
}

/** Maps a free-text answer to an EPDS option index (0-3), or null when unsure. */
export interface AnswerInterpreter {
  interpret(request: InterpretRequest): Promise<number | null>;
}

export interface InterpretRequest {
  readonly itemIndex: number;
  readonly language: Language;
  readonly text: string;
}

/** A completed screening. Holds no answers and no phone number. */
export interface ScreeningRecord {
  readonly id: string;
  readonly completedAt: Date;
  readonly channel: Channel;
  readonly tier: RiskTier;
  readonly epdsScore: number | null;
}

export const REFERRAL_STATUSES = ["open", "contacted"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export interface Referral {
  readonly id: string;
  readonly createdAt: Date;
  readonly channel: Channel;
  readonly tier: RiskTier;
  readonly epdsScore: number | null;
  readonly flags: readonly Flag[];
  readonly ward: string | null;
  /** Encrypted with the Cipher; decrypt only to show staff. */
  readonly phoneCiphertext: string;
  readonly status: ReferralStatus;
  readonly contactedAt: Date | null;
}

export interface CaseRepository {
  recordScreening(record: ScreeningRecord): void;
  createReferral(referral: Referral): void;
  listOpenReferrals(): readonly Referral[];
  markContacted(id: string, at: Date): boolean;
  listScreenings(): readonly ScreeningRecord[];
  listReferrals(): readonly Referral[];
  /** Deletes contacted referrals older than the cut-off. Returns how many were deleted. */
  purgeContactedBefore(cutoff: Date): number;
}

/** Tells staff that a new referral is waiting. Must not include the phone number. */
export interface ReferralNotifier {
  notify(referral: Pick<Referral, "id" | "tier" | "ward" | "createdAt">): Promise<void>;
}
