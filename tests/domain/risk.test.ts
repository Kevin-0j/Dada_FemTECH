import { describe, expect, it } from "vitest";
import { EPDS_ITEMS } from "../../src/domain/epds.ts";
import { DEFAULT_THRESHOLDS, assess, tierRank } from "../../src/domain/risk.ts";

/** Builds answers (option indexes) that add up to a target score, leaving item 10 at zero. */
function answersFor(target: number): number[] {
  let remaining = target;
  return EPDS_ITEMS.map((item, index) => {
    const wanted = index === 9 ? 0 : Math.min(3, remaining);
    remaining -= wanted;
    return item.options.findIndex((option) => option.score === wanted);
  });
}

const safe = { harmAtHome: "no", safeNow: "yes" } as const;

describe("assess", () => {
  it.each([
    [0, "low"],
    [9, "low"],
    [10, "moderate"],
    [12, "moderate"],
    [13, "high"],
    [27, "high"],
  ] as const)("EPDS %i is %s risk", (score, tier) => {
    const result = assess({ epdsAnswers: answersFor(score), ...safe }, DEFAULT_THRESHOLDS);
    expect(result.epdsScore).toBe(score);
    expect(result.tier).toBe(tier);
  });

  it("treats any thought of self-harm as urgent, even with a low total", () => {
    const answers = answersFor(0);
    answers[9] = EPDS_ITEMS[9]?.options.findIndex((option) => option.score === 1) ?? -1;
    const result = assess({ epdsAnswers: answers, ...safe }, DEFAULT_THRESHOLDS);
    expect(result.selfHarmFlag).toBe(true);
    expect(result.tier).toBe("urgent");
  });

  it("treats not being safe right now as urgent", () => {
    const result = assess(
      { epdsAnswers: answersFor(0), harmAtHome: "no", safeNow: "no" },
      DEFAULT_THRESHOLDS,
    );
    expect(result.tier).toBe("urgent");
  });

  it("treats harm at home as high risk", () => {
    const result = assess(
      { epdsAnswers: answersFor(0), harmAtHome: "yes", safeNow: "yes" },
      DEFAULT_THRESHOLDS,
    );
    expect(result.tier).toBe("high");
  });

  it("orders tiers from most to least urgent", () => {
    expect(tierRank("urgent")).toBeLessThan(tierRank("high"));
    expect(tierRank("moderate")).toBeLessThan(tierRank("low"));
  });
});
