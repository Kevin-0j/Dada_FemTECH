import type { Localized } from "./language.ts";

/** Answers to the two safety questions asked after the EPDS. */
export type HarmAtHome = "yes" | "no" | "declined";
export type SafeNow = "yes" | "no";

export interface SafetyQuestion {
  readonly question: Localized;
  readonly options: readonly Localized[];
}

export const HARM_AT_HOME_QUESTION: SafetyQuestion = {
  question: {
    sheng: "Kuna mtu kwa keja anakuumiza, kukutishia ama kukuforce?",
    sw: "Kuna mtu nyumbani anayekuumiza, kukutishia au kukulazimisha?",
    en: "Is someone at home hurting, threatening or forcing you?",
  },
  options: [
    { sheng: "Ndio", sw: "Ndio", en: "Yes" },
    { sheng: "Hapana", sw: "Hapana", en: "No" },
    { sheng: "Sitaki kusema", sw: "Sitaki kusema", en: "Prefer not to say" },
  ],
};

export const SAFE_NOW_QUESTION: SafetyQuestion = {
  question: {
    sheng: "Uko safe saa hii?",
    sw: "Uko salama sasa hivi?",
    en: "Are you safe right now?",
  },
  options: [
    { sheng: "Ndio", sw: "Ndio", en: "Yes" },
    { sheng: "Hapana", sw: "Hapana", en: "No" },
  ],
};

export const HARM_AT_HOME_VALUES: readonly HarmAtHome[] = ["yes", "no", "declined"];
export const SAFE_NOW_VALUES: readonly SafeNow[] = ["yes", "no"];

export type DangerKind = "self_harm" | "violence";

/**
 * Phrases that mean a person may be in danger. Matching is deliberately broad: a false alarm
 * costs a counsellor a few minutes, a missed one can cost a life. This list is checked before
 * any AI interpretation and is never replaced by it. The clinical lead owns this list.
 */
const DANGER_PATTERNS: ReadonlyArray<{ readonly kind: DangerKind; readonly pattern: RegExp }> = [
  { kind: "self_harm", pattern: /\b(ku|ni|nita|na|ta)?jiua\b|\bnijiue\b/ },
  { kind: "self_harm", pattern: /\bkujiumiza\b|\bnijiumize\b|\bnajiumiza\b|\bnitajiumiza\b/ },
  {
    kind: "self_harm",
    pattern: /\bkujitoa uhai\b|\bsitaki kuishi\b|\bnimechoka na (maisha|life)\b/,
  },
  { kind: "self_harm", pattern: /\bmaisha (haina|hayana) maana\b|\bnataka kufa\b/ },
  { kind: "self_harm", pattern: /\bkill myself\b|\bsuicid|\bend my life\b|\bwant to die\b/ },
  { kind: "self_harm", pattern: /\bhurt myself\b|\bharm myself\b/ },
  { kind: "violence", pattern: /\banani(piga|chapa|umiza|tishia|lazimisha|baka)\b/ },
  { kind: "violence", pattern: /\b(atani|ataka kuni|anataka kuni)(ua|piga|umiza)\b/ },
  { kind: "violence", pattern: /\bamenibaka\b|\bkubakwa\b|\bnimebakwa\b/ },
  { kind: "violence", pattern: /\b(he|she|they) (beats?|hits?|hurts?|raped?) me\b/ },
  { kind: "violence", pattern: /\bgoing to kill me\b|\bthreaten(s|ed)? to kill\b/ },
];

/** Lower-cases and removes punctuation so that patterns match free text from phones. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the kinds of danger found in a free-text message, if any. */
export function detectDanger(text: string): readonly DangerKind[] {
  const normalized = normalizeText(text);
  const kinds = new Set<DangerKind>();
  for (const { kind, pattern } of DANGER_PATTERNS) {
    if (pattern.test(normalized)) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}
