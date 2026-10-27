import type { Referral, ReferralNotifier } from "../../contracts/ports.ts";

type Notice = Pick<Referral, "id" | "tier" | "ward" | "createdAt">;

/** Writes a one-line notice to the server log. No phone numbers. */
export class LogNotifier implements ReferralNotifier {
  notify(referral: Notice): Promise<void> {
    console.info(
      `[referral] ${referral.tier} referral ${referral.id} (${referral.ward ?? "area not given"})`,
    );
    return Promise.resolve();
  }
}

/**
 * Posts a short notice to a webhook, such as a Slack, Teams or Google Chat incoming webhook, so
 * the counsellor on duty sees new urgent cases quickly. Failures are logged and never block the
 * user's conversation.
 */
export class WebhookNotifier implements ReferralNotifier {
  readonly #url: string;
  readonly #fetch: typeof fetch;

  constructor(url: string, fetchImpl: typeof fetch = fetch) {
    this.#url = url;
    this.#fetch = fetchImpl;
  }

  async notify(referral: Notice): Promise<void> {
    const text = `New ${referral.tier} Dada referral (${referral.ward ?? "area not given"}). Open the staff queue.`;
    try {
      const response = await this.#fetch(this.#url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, id: referral.id, tier: referral.tier }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) console.warn(`[referral] webhook returned ${response.status}`);
    } catch (error) {
      console.warn(`[referral] webhook failed: ${String(error)}`);
    }
  }
}
