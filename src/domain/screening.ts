import { EPDS_ITEMS } from "./epds.ts";
import type { Language } from "./language.ts";
import {
  CALLBACK_CHOICE,
  CALLBACK_NUMBER,
  CONSENT,
  DANGER_INTERRUPT,
  EXIT,
  EXIT_OPTION,
  INVALID,
  INVALID_PHONE,
  LANGUAGE_MENU,
  NO_REFERRAL,
  NO_WORDS,
  OFFER,
  OTHER_WARD,
  REFERRAL_DONE,
  WARD_QUESTION,
  YES_WORDS,
  t,
} from "./messages.ts";
import { normalizeKenyanPhone } from "./phone.ts";
import { assess, type RiskThresholds, type RiskTier } from "./risk.ts";
import {
  HARM_AT_HOME_QUESTION,
  HARM_AT_HOME_VALUES,
  SAFE_NOW_QUESTION,
  SAFE_NOW_VALUES,
  normalizeText,
  type DangerKind,
  type HarmAtHome,
  type SafetyQuestion,
} from "./safety.ts";

/**
 * The screening conversation as a pure state machine. It knows nothing about USSD, WhatsApp,
 * storage or time: adapters turn requests into inputs, and the application layer acts on the
 * events it returns.
 */

export type Step =
  | { readonly kind: "language" }
  | { readonly kind: "consent" }
  | { readonly kind: "epds"; readonly item: number }
  | { readonly kind: "harmAtHome" }
  | { readonly kind: "safeNow" }
  | { readonly kind: "offer" }
  | { readonly kind: "callbackChoice" }
  | { readonly kind: "callbackNumber" }
  | { readonly kind: "ward" };

export type Flag =
  | "self_harm_item"
  | "not_safe_now"
  | "harm_at_home"
  | "danger_phrase_self_harm"
  | "danger_phrase_violence";

/** The result of screening, or of a danger phrase that cut the screening short. */
export interface Triage {
  readonly tier: RiskTier;
  /** Null when a danger phrase interrupted the questionnaire. */
  readonly epdsScore: number | null;
  readonly flags: readonly Flag[];
}

export type Callback =
  { readonly kind: "channel" } | { readonly kind: "other"; readonly phone: string };

export interface Session {
  readonly step: Step;
  readonly language: Language;
  readonly epdsAnswers: readonly number[];
  readonly harmAtHome: HarmAtHome | null;
  readonly triage: Triage | null;
  readonly callback: Callback | null;
}

export type Input =
  | { readonly kind: "start" }
  | { readonly kind: "exit" }
  | { readonly kind: "choice"; readonly value: number }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "danger"; readonly kinds: readonly DangerKind[] };

export type ScreeningEvent =
  | { readonly type: "screening_completed"; readonly triage: Triage }
  | {
      readonly type: "referral_requested";
      readonly triage: Triage;
      readonly callback: Callback;
      readonly ward: string | null;
    };

export interface Transition {
  /** Null when the conversation has ended. */
  readonly session: Session | null;
  readonly reply: string;
  readonly events: readonly ScreeningEvent[];
}

export interface ScreeningContext {
  readonly thresholds: RiskThresholds;
  /** Areas offered for follow-up visits, e.g. ["Kangemi", "Dagoretti"]. */
  readonly wards: readonly string[];
}

const LANGUAGE_BY_CHOICE: Readonly<Record<number, Language>> = { 1: "sheng", 2: "sw", 3: "en" };

export function newSession(): Session {
  return {
    step: { kind: "language" },
    language: "sheng",
    epdsAnswers: [],
    harmAtHome: null,
    triage: null,
    callback: null,
  };
}

/** Number of numbered options on the screen for a step. */
export function optionCount(step: Step, context: ScreeningContext): number {
  switch (step.kind) {
    case "language":
      return 3;
    case "consent":
    case "safeNow":
    case "offer":
      return 2;
    case "epds":
      return 4;
    case "harmAtHome":
    case "callbackChoice":
      return 3;
    case "ward":
      return context.wards.length + 1;
    case "callbackNumber":
      return 0;
  }
}

/** Steps where option 1 means yes and option 2 means no, so "ndio" and "hapana" can be typed. */
function isYesNoStep(step: Step): boolean {
  return ["consent", "harmAtHome", "safeNow", "offer", "callbackChoice"].includes(step.kind);
}

/**
 * Turns raw text from a phone into an input for the current step. Returns null when the text
 * is not a valid answer and the caller may try to interpret it (WhatsApp free text).
 */
export function parseInput(raw: string, session: Session, context: ScreeningContext): Input | null {
  const text = raw.trim();
  if (text === "0") return { kind: "exit" };
  if (session.step.kind === "callbackNumber") return { kind: "text", value: text };

  const count = optionCount(session.step, context);
  if (/^\d{1,2}$/.test(text)) {
    const value = Number(text);
    return value >= 1 && value <= count ? { kind: "choice", value } : null;
  }
  if (isYesNoStep(session.step)) {
    const word = normalizeText(text);
    if (YES_WORDS.has(word)) return { kind: "choice", value: 1 };
    if (NO_WORDS.has(word)) return { kind: "choice", value: 2 };
  }
  return null;
}

/** The text to show for the current step. */
export function render(session: Session, context: ScreeningContext): string {
  const { step, language } = session;
  switch (step.kind) {
    case "language":
      return LANGUAGE_MENU;
    case "consent":
      return t(CONSENT, language);
    case "epds": {
      const item = EPDS_ITEMS[step.item];
      if (item === undefined) throw new RangeError(`No EPDS item ${step.item}`);
      const options = item.options.map((option, index) => `${index + 1} ${option.label[language]}`);
      return withExit([item.question[language], ...options], language);
    }
    case "harmAtHome":
      return renderSafety(HARM_AT_HOME_QUESTION, language);
    case "safeNow":
      return renderSafety(SAFE_NOW_QUESTION, language);
    case "offer":
      return session.triage?.flags.some((flag) => flag.startsWith("danger_phrase"))
        ? t(DANGER_INTERRUPT, language)
        : t(OFFER[session.triage?.tier ?? "low"], language);
    case "callbackChoice":
      return t(CALLBACK_CHOICE, language);
    case "callbackNumber":
      return withExit([t(CALLBACK_NUMBER, language)], language);
    case "ward": {
      const wards = [...context.wards, t(OTHER_WARD, language)].map(
        (ward, index) => `${index + 1} ${ward}`,
      );
      return withExit([t(WARD_QUESTION, language), ...wards], language);
    }
  }
}

function renderSafety(question: SafetyQuestion, language: Language): string {
  const options = question.options.map((option, index) => `${index + 1} ${option[language]}`);
  return withExit([question.question[language], ...options], language);
}

function withExit(lines: readonly string[], language: Language): string {
  return [...lines, t(EXIT_OPTION, language)].join("\n");
}

/** Applies one input to a session. */
export function advance(session: Session, input: Input, context: ScreeningContext): Transition {
  if (input.kind === "exit") return end(t(EXIT, session.language));
  if (input.kind === "start") return stay(newSession(), context);
  if (input.kind === "danger") return interruptForDanger(session, input.kinds, context);

  const { step } = session;
  switch (step.kind) {
    case "language": {
      const language = input.kind === "choice" ? LANGUAGE_BY_CHOICE[input.value] : undefined;
      if (language === undefined) return invalid(session, context);
      return stay({ ...session, language, step: { kind: "consent" } }, context);
    }
    case "consent":
      if (input.kind !== "choice") return invalid(session, context);
      return input.value === 1
        ? stay({ ...session, step: { kind: "epds", item: 0 } }, context)
        : end(t(EXIT, session.language));
    case "epds": {
      if (input.kind !== "choice") return invalid(session, context);
      const epdsAnswers = [...session.epdsAnswers, input.value - 1];
      const next: Step =
        step.item + 1 < EPDS_ITEMS.length
          ? { kind: "epds", item: step.item + 1 }
          : { kind: "harmAtHome" };
      return stay({ ...session, epdsAnswers, step: next }, context);
    }
    case "harmAtHome": {
      const harmAtHome = input.kind === "choice" ? HARM_AT_HOME_VALUES[input.value - 1] : undefined;
      if (harmAtHome === undefined) return invalid(session, context);
      return stay({ ...session, harmAtHome, step: { kind: "safeNow" } }, context);
    }
    case "safeNow":
      return completeScreening(session, input, context);
    case "offer":
      if (input.kind !== "choice") return invalid(session, context);
      return input.value === 1
        ? stay({ ...session, step: { kind: "callbackChoice" } }, context)
        : end(t(NO_REFERRAL, session.language));
    case "callbackChoice":
      if (input.kind !== "choice") return invalid(session, context);
      if (input.value === 1) return chooseCallback(session, { kind: "channel" }, context);
      if (input.value === 2) return stay({ ...session, step: { kind: "callbackNumber" } }, context);
      return end(t(NO_REFERRAL, session.language));
    case "callbackNumber": {
      const phone = input.kind === "text" ? normalizeKenyanPhone(input.value) : null;
      if (phone === null) {
        return {
          session,
          reply: `${t(INVALID_PHONE, session.language)}\n${render(session, context)}`,
          events: [],
        };
      }
      return chooseCallback(session, { kind: "other", phone }, context);
    }
    case "ward": {
      if (input.kind !== "choice") return invalid(session, context);
      const ward = context.wards[input.value - 1] ?? null;
      return requestReferral(session, ward);
    }
  }
}

function completeScreening(session: Session, input: Input, context: ScreeningContext): Transition {
  const safeNow = input.kind === "choice" ? SAFE_NOW_VALUES[input.value - 1] : undefined;
  if (safeNow === undefined || session.harmAtHome === null) return invalid(session, context);

  const assessment = assess(
    { epdsAnswers: session.epdsAnswers, harmAtHome: session.harmAtHome, safeNow },
    context.thresholds,
  );
  const flags: Flag[] = [];
  if (assessment.selfHarmFlag) flags.push("self_harm_item");
  if (assessment.safeNow === "no") flags.push("not_safe_now");
  if (assessment.harmAtHome === "yes") flags.push("harm_at_home");
  const triage: Triage = { tier: assessment.tier, epdsScore: assessment.epdsScore, flags };

  const next: Session = { ...session, triage, step: { kind: "offer" } };
  return {
    session: next,
    reply: render(next, context),
    events: [{ type: "screening_completed", triage }],
  };
}

function interruptForDanger(
  session: Session,
  kinds: readonly DangerKind[],
  context: ScreeningContext,
): Transition {
  const dangerFlags = kinds.map((kind): Flag => `danger_phrase_${kind}`);
  const flags = [...new Set([...(session.triage?.flags ?? []), ...dangerFlags])];
  const triage: Triage = { tier: "urgent", epdsScore: session.triage?.epdsScore ?? null, flags };
  return stay({ ...session, triage, step: { kind: "offer" } }, context);
}

function chooseCallback(
  session: Session,
  callback: Callback,
  context: ScreeningContext,
): Transition {
  const next: Session = { ...session, callback };
  if (context.wards.length === 0) return requestReferral(next, null);
  return stay({ ...next, step: { kind: "ward" } }, context);
}

function requestReferral(session: Session, ward: string | null): Transition {
  const { triage, callback } = session;
  if (triage === null || callback === null) {
    throw new Error("Referral requested before screening and callback were complete");
  }
  const when = triage.tier === "urgent" || triage.tier === "high" ? "today" : "soon";
  return {
    session: null,
    reply: t(REFERRAL_DONE[when], session.language),
    events: [{ type: "referral_requested", triage, callback, ward }],
  };
}

function stay(session: Session, context: ScreeningContext): Transition {
  return { session, reply: render(session, context), events: [] };
}

function invalid(session: Session, context: ScreeningContext): Transition {
  return {
    session,
    reply: `${t(INVALID, session.language)}\n${render(session, context)}`,
    events: [],
  };
}

function end(reply: string): Transition {
  return { session: null, reply, events: [] };
}
