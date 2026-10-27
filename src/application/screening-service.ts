import { randomUUID } from "node:crypto";
import type {
  AnswerInterpreter,
  CaseRepository,
  Channel,
  Cipher,
  Clock,
  ReferralNotifier,
  SessionStore,
} from "../contracts/ports.ts";
import { detectDanger } from "../domain/safety.ts";
import {
  advance,
  newSession,
  parseInput,
  render,
  type Input,
  type ScreeningContext,
  type ScreeningEvent,
  type Session,
} from "../domain/screening.ts";

export interface IncomingMessage {
  readonly channel: Channel;
  /** Stable key for this conversation: the USSD session id or a hash of the WhatsApp number. */
  readonly sessionKey: string;
  /** The number the message came from, in E.164. Used only if the user asks to be called on it. */
  readonly fromPhone: string;
  /** What the user typed. Empty on the first USSD request. */
  readonly text: string;
}

export interface Reply {
  readonly text: string;
  /** True when the conversation is over (USSD "END"). */
  readonly ended: boolean;
}

export interface ScreeningServiceDeps {
  readonly sessions: SessionStore;
  readonly cases: CaseRepository;
  readonly cipher: Cipher;
  readonly clock: Clock;
  readonly notifier: ReferralNotifier;
  /** Optional. Without it, free-text answers to questionnaire items are asked again. */
  readonly interpreter: AnswerInterpreter | null;
  readonly context: ScreeningContext;
  readonly newId?: () => string;
}

/** Runs one step of a screening conversation for any channel. */
export class ScreeningService {
  readonly #deps: ScreeningServiceDeps;
  readonly #newId: () => string;

  constructor(deps: ScreeningServiceDeps) {
    this.#deps = deps;
    this.#newId = deps.newId ?? randomUUID;
  }

  async handle(message: IncomingMessage): Promise<Reply> {
    const { sessions, context } = this.#deps;
    const existing = sessions.get(message.sessionKey);
    const text = message.text.trim();

    // Danger phrases are checked first, on every free-text message, before any AI is involved.
    const dangerKinds = message.channel === "whatsapp" ? detectDanger(text) : [];

    if (existing === undefined && dangerKinds.length === 0) {
      const session = newSession();
      sessions.set(message.sessionKey, session);
      return { text: render(session, context), ended: false };
    }

    const session = existing ?? newSession();
    const input: Input =
      dangerKinds.length > 0
        ? { kind: "danger", kinds: dangerKinds }
        : await this.#resolveInput(text, session);

    const transition = advance(session, input, context);
    for (const event of transition.events) {
      this.#apply(event, message);
    }

    if (transition.session === null) {
      sessions.delete(message.sessionKey);
      return { text: transition.reply, ended: true };
    }
    sessions.set(message.sessionKey, transition.session);
    return { text: transition.reply, ended: false };
  }

  async #resolveInput(text: string, session: Session): Promise<Input> {
    const { context, interpreter } = this.#deps;
    const parsed = parseInput(text, session, context);
    if (parsed !== null) return parsed;

    if (session.step.kind === "epds" && interpreter !== null && text.length > 0) {
      const optionIndex = await interpreter.interpret({
        itemIndex: session.step.item,
        language: session.language,
        text,
      });
      if (optionIndex !== null) return { kind: "choice", value: optionIndex + 1 };
    }
    return { kind: "text", value: text };
  }

  #apply(event: ScreeningEvent, message: IncomingMessage): void {
    const { cases, cipher, clock, notifier } = this.#deps;
    const now = clock.now();
    switch (event.type) {
      case "screening_completed":
        cases.recordScreening({
          id: this.#newId(),
          completedAt: now,
          channel: message.channel,
          tier: event.triage.tier,
          epdsScore: event.triage.epdsScore,
        });
        return;
      case "referral_requested": {
        const phone = event.callback.kind === "channel" ? message.fromPhone : event.callback.phone;
        const referral = {
          id: this.#newId(),
          createdAt: now,
          channel: message.channel,
          tier: event.triage.tier,
          epdsScore: event.triage.epdsScore,
          flags: event.triage.flags,
          ward: event.ward,
          phoneCiphertext: cipher.encrypt(phone),
          status: "open",
          contactedAt: null,
        } as const;
        cases.createReferral(referral);
        // Not awaited: USSD gateways time out after a few seconds, and the referral is already
        // saved, so a slow notification must never cost the user their reply.
        notifier
          .notify({
            id: referral.id,
            tier: referral.tier,
            ward: referral.ward,
            createdAt: referral.createdAt,
          })
          .catch((error: unknown) => console.warn(`[referral] notify failed: ${String(error)}`));
        return;
      }
    }
  }
}
