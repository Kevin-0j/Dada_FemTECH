import { SELF_HARM_ITEM_INDEX, optionScore, scoreEpds } from "./epds.ts";
import type { HarmAtHome, SafeNow } from "./safety.ts";

/**
 * Risk tiers, from most to least urgent.
 * - urgent: possible self-harm, or not safe right now. A human must act the same day.
 * - high: probable depression, or harm at home. Counsellor follow-up.
 * - moderate: possible depression. Health promoter follow-up.
 * - low: no follow-up needed, self-care information only.
 */
export const RISK_TIERS = ["urgent", "high", "moderate", "low"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

/** EPDS cut-offs. Set by the clinical lead; Kenyan studies have used 10 and 13. */
export interface RiskThresholds {
  readonly possibleDepression: number;
  readonly probableDepression: number;
}

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  possibleDepression: 10,
  probableDepression: 13,
};

export interface Assessment {
  readonly epdsScore: number;
  readonly selfHarmFlag: boolean;
  readonly harmAtHome: HarmAtHome;
  readonly safeNow: SafeNow;
  readonly tier: RiskTier;
}

export interface AssessmentInput {
  readonly epdsAnswers: readonly number[];
  readonly harmAtHome: HarmAtHome;
  readonly safeNow: SafeNow;
}

export function assess(input: AssessmentInput, thresholds: RiskThresholds): Assessment {
  const epdsScore = scoreEpds(input.epdsAnswers);
  const selfHarmAnswer = input.epdsAnswers[SELF_HARM_ITEM_INDEX];
  const selfHarmFlag =
    selfHarmAnswer !== undefined && optionScore(SELF_HARM_ITEM_INDEX, selfHarmAnswer) > 0;
  return {
    epdsScore,
    selfHarmFlag,
    harmAtHome: input.harmAtHome,
    safeNow: input.safeNow,
    tier: tierFor(epdsScore, selfHarmFlag, input.harmAtHome, input.safeNow, thresholds),
  };
}

function tierFor(
  epdsScore: number,
  selfHarmFlag: boolean,
  harmAtHome: HarmAtHome,
  safeNow: SafeNow,
  thresholds: RiskThresholds,
): RiskTier {
  if (selfHarmFlag || safeNow === "no") return "urgent";
  if (epdsScore >= thresholds.probableDepression || harmAtHome === "yes") return "high";
  if (epdsScore >= thresholds.possibleDepression) return "moderate";
  return "low";
}

/** Sort key: lower is more urgent. */
export function tierRank(tier: RiskTier): number {
  return RISK_TIERS.indexOf(tier);
}
