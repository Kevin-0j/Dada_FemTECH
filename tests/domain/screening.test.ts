import { describe, expect, it } from "vitest";
import { EPDS_ITEMS } from "../../src/domain/epds.ts";
import { LANGUAGES } from "../../src/domain/language.ts";
import { INVALID, INVALID_PHONE, OFFER } from "../../src/domain/messages.ts";
import { DEFAULT_THRESHOLDS, RISK_TIERS } from "../../src/domain/risk.ts";
import {
  advance,
  newSession,
  parseInput,
  render,
  type Input,
  type ScreeningContext,
  type Session,
  type Step,
  type Transition,
} from "../../src/domain/screening.ts";

const context: ScreeningContext = {
  thresholds: DEFAULT_THRESHOLDS,
  wards: ["Kangemi", "Dagoretti"],
};

/** Feeds raw replies through parseInput and advance, as an adapter would. */
function play(replies: readonly string[], start: Session = newSession()) {
  let session: Session | null = start;
  const transitions: Transition[] = [];
  for (const reply of replies) {
    if (session === null)
      throw new Error(`Conversation ended before reply ${JSON.stringify(reply)}`);
    const input: Input = parseInput(reply, session, context) ?? { kind: "text", value: reply };
    const transition = advance(session, input, context);
    transitions.push(transition);
    session = transition.session;
  }
  const last = transitions.at(-1);
  if (last === undefined) throw new Error("No replies given");
  return { last, session, events: transitions.flatMap((t) => t.events) };
}

/** Answer option 4 to every EPDS item: the lowest score for most items. */
const calmEpds = EPDS_ITEMS.map((item) => String(item.options.findIndex((o) => o.score === 0) + 1));
const distressedEpds = EPDS_ITEMS.map((item, index) =>
  String(item.options.findIndex((o) => o.score === (index === 9 ? 0 : 3)) + 1),
);

describe("screening conversation", () => {
  it("runs a low-risk screening in Sheng and ends without a referral", () => {
    const { last, events } = play(["1", "1", ...calmEpds, "2", "1", "2"]);
    expect(last.session).toBeNull();
    expect(events).toEqual([
      { type: "screening_completed", triage: { tier: "low", epdsScore: 0, flags: [] } },
    ]);
  });

  it("refers a high-risk mother to a counsellor on her own number", () => {
    const { last, events } = play(["2", "1", ...distressedEpds, "2", "1", "1", "1", "1"]);
    expect(last.session).toBeNull();
    expect(last.reply).toContain("leo");
    expect(events.at(-1)).toEqual({
      type: "referral_requested",
      triage: { tier: "high", epdsScore: 27, flags: [] },
      callback: { kind: "channel" },
      ward: "Kangemi",
    });
  });

  it("takes a different callback number for women on a shared phone", () => {
    const { events } = play(["3", "1", ...distressedEpds, "1", "1", "1", "2", "0722 000 111", "3"]);
    expect(events.at(-1)).toMatchObject({
      type: "referral_requested",
      triage: { tier: "high", flags: ["harm_at_home"] },
      callback: { kind: "other", phone: "+254722000111" },
      ward: null,
    });
  });

  it("asks again when a callback number is not valid", () => {
    const { last } = play(["3", "1", ...distressedEpds, "2", "1", "1", "2", "12345"]);
    expect(last.session?.step.kind).toBe("callbackNumber");
    expect(last.reply.startsWith(INVALID_PHONE.en)).toBe(true);
  });

  it("marks the screening urgent when the mother is not safe right now", () => {
    const { events, last } = play(["3", "1", ...calmEpds, "2", "2"]);
    expect(events[0]).toEqual({
      type: "screening_completed",
      triage: { tier: "urgent", epdsScore: 0, flags: ["not_safe_now"] },
    });
    expect(last.reply).toBe(OFFER.urgent.en);
  });

  it("exits on 0 from any screen with a neutral goodbye", () => {
    const { last } = play(["1", "1", "2", "0"]);
    expect(last.session).toBeNull();
    expect(last.reply).toBe("Asante. Kwaheri.");
  });

  it("ends politely when consent is declined", () => {
    const { last, events } = play(["2", "2"]);
    expect(last.session).toBeNull();
    expect(events).toEqual([]);
  });

  it("re-asks the same question on an invalid answer", () => {
    const { last } = play(["2", "1", "9"]);
    expect(last.session?.step).toEqual({ kind: "epds", item: 0 });
    expect(last.reply.startsWith(INVALID.sw)).toBe(true);
  });

  it("accepts yes and no words on yes/no screens", () => {
    const { last } = play(["1", "ndio"]);
    expect(last.session?.step).toEqual({ kind: "epds", item: 0 });
  });

  it("interrupts with an urgent offer when danger is detected", () => {
    const session = play(["1", "1", "1"]).session;
    if (session === null) throw new Error("expected a session");
    const transition = advance(session, { kind: "danger", kinds: ["self_harm"] }, context);
    expect(transition.session?.step.kind).toBe("offer");
    expect(transition.session?.triage).toEqual({
      tier: "urgent",
      epdsScore: null,
      flags: ["danger_phrase_self_harm"],
    });
    expect(transition.reply).toContain("999");
  });

  it("skips the area question when no areas are configured", () => {
    const noWards = { ...context, wards: [] };
    let session: Session | null = newSession();
    for (const reply of ["3", "1", ...distressedEpds, "2", "1", "1"]) {
      if (session === null) break;
      session = advance(
        session,
        parseInput(reply, session, noWards) ?? { kind: "text", value: reply },
        noWards,
      ).session;
    }
    if (session === null) throw new Error("expected a session");
    const last = advance(session, { kind: "choice", value: 1 }, noWards);
    expect(last.events.at(-1)).toMatchObject({ type: "referral_requested", ward: null });
  });
});

describe("USSD screen size", () => {
  // Africa's Talking shows at most 182 characters, including the "CON " prefix.
  const LIMIT = 182 - "CON ".length;

  const steps: Step[] = [
    { kind: "language" },
    { kind: "consent" },
    ...EPDS_ITEMS.map((_, item): Step => ({ kind: "epds", item })),
    { kind: "harmAtHome" },
    { kind: "safeNow" },
    { kind: "callbackChoice" },
    { kind: "callbackNumber" },
    { kind: "ward" },
  ];

  for (const language of LANGUAGES) {
    it(`fits every ${language} screen, including the invalid-answer prefix`, () => {
      for (const step of steps) {
        const screen = render({ ...newSession(), language, step }, context);
        const longest = Math.max(INVALID[language].length, INVALID_PHONE[language].length);
        expect(
          screen.length + longest + 1,
          `${step.kind} ${JSON.stringify(step)}`,
        ).toBeLessThanOrEqual(LIMIT);
      }
      for (const tier of RISK_TIERS) {
        const screen = render(
          {
            ...newSession(),
            language,
            step: { kind: "offer" },
            triage: { tier, epdsScore: 0, flags: [] },
          },
          context,
        );
        expect(screen.length, `offer ${tier}`).toBeLessThanOrEqual(LIMIT);
      }
    });
  }
});
