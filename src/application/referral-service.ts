import type { CaseRepository, Cipher, Clock, Referral } from "../contracts/ports.ts";
import { tierRank } from "../domain/risk.ts";

export interface ReferralView extends Omit<Referral, "phoneCiphertext"> {
  readonly phone: string;
}

export interface ReferralServiceDeps {
  readonly cases: CaseRepository;
  readonly cipher: Cipher;
  readonly clock: Clock;
  /** Contacted referrals are deleted after this many days. */
  readonly retentionDays: number;
}

/** What counsellors and health promoters do with referrals. */
export class ReferralService {
  readonly #deps: ReferralServiceDeps;

  constructor(deps: ReferralServiceDeps) {
    this.#deps = deps;
  }

  /** Open referrals, most urgent first, then oldest first. */
  listOpen(): readonly ReferralView[] {
    const { cases, cipher } = this.#deps;
    return cases
      .listOpenReferrals()
      .toSorted(
        (a, b) =>
          tierRank(a.tier) - tierRank(b.tier) || a.createdAt.getTime() - b.createdAt.getTime(),
      )
      .map(({ phoneCiphertext, ...rest }) => ({ ...rest, phone: cipher.decrypt(phoneCiphertext) }));
  }

  markContacted(id: string): boolean {
    return this.#deps.cases.markContacted(id, this.#deps.clock.now());
  }

  purgeExpired(): number {
    const { cases, clock, retentionDays } = this.#deps;
    const cutoff = new Date(clock.now().getTime() - retentionDays * 24 * 60 * 60 * 1000);
    return cases.purgeContactedBefore(cutoff);
  }
}
