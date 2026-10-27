import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone } from "../../src/domain/phone.ts";
import { detectDanger, normalizeText } from "../../src/domain/safety.ts";

describe("detectDanger", () => {
  it.each([
    ["Nataka kujiua", "self_harm"],
    ["sitaki kuishi tena", "self_harm"],
    ["Nimechoka na life", "self_harm"],
    ["I want to kill myself.", "self_harm"],
    ["Bwana ananipiga kila siku", "violence"],
    ["he beats me", "violence"],
    ["anataka kuniua!!", "violence"],
  ])("flags %j as %s", (text, kind) => {
    expect(detectDanger(text)).toContain(kind);
  });

  it.each(["1", "Ndio", "Saa zingine", "Niko jua kali leo", "Nimechoka sana na kazi", "hapana"])(
    "does not flag %j",
    (text) => {
      expect(detectDanger(text)).toEqual([]);
    },
  );

  it("normalises case, punctuation and spacing", () => {
    expect(normalizeText("  SAA   zingine!! ")).toBe("saa zingine");
  });
});

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0112 345 678", "+254112345678"],
    ["+254712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["712-345-678", "+254712345678"],
  ])("normalises %s", (raw, expected) => {
    expect(normalizeKenyanPhone(raw)).toBe(expected);
  });

  it.each(["0", "12345", "0812345678", "+255712345678", "abc"])("rejects %s", (raw) => {
    expect(normalizeKenyanPhone(raw)).toBeNull();
  });
});
