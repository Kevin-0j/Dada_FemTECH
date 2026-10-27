import { describe, expect, it } from "vitest";
import { EPDS_ITEMS, EPDS_MAX_SCORE, optionScore, scoreEpds } from "../../src/domain/epds.ts";
import { LANGUAGES } from "../../src/domain/language.ts";

describe("EPDS", () => {
  it("has the ten published items, each scoring 0 to 3 exactly once", () => {
    expect(EPDS_ITEMS.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const item of EPDS_ITEMS) {
      expect(item.options.map((option) => option.score).toSorted()).toEqual([0, 1, 2, 3]);
    }
  });

  it("keeps the published scoring direction: items 1, 2 and 4 ascend, the rest descend", () => {
    const ascending = EPDS_ITEMS.filter((item) => item.options[0].score === 0).map((i) => i.id);
    expect(ascending).toEqual([1, 2, 4]);
  });

  it("has every question and option in every language", () => {
    for (const item of EPDS_ITEMS) {
      for (const language of LANGUAGES) {
        expect(item.question[language].length).toBeGreaterThan(0);
        for (const option of item.options) expect(option.label[language].length).toBeGreaterThan(0);
      }
    }
  });

  it("scores the lowest and highest possible answers", () => {
    const lowest = EPDS_ITEMS.map((item) => item.options.findIndex((o) => o.score === 0));
    const highest = EPDS_ITEMS.map((item) => item.options.findIndex((o) => o.score === 3));
    expect(scoreEpds(lowest)).toBe(0);
    expect(scoreEpds(highest)).toBe(EPDS_MAX_SCORE);
  });

  it("rejects incomplete answers and unknown options", () => {
    expect(() => scoreEpds([0, 1])).toThrow(RangeError);
    expect(() => optionScore(0, 4)).toThrow(RangeError);
  });
});
