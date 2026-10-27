import type { Localized } from "./language.ts";

/**
 * Edinburgh Postnatal Depression Scale (EPDS).
 *
 * Source: Cox, J.L., Holden, J.M., and Sagovsky, R. (1987). Detection of postnatal depression:
 * development of the 10-item Edinburgh Postnatal Depression Scale. British Journal of Psychiatry
 * 150:782-786. The scale may be reproduced without permission provided the source is cited.
 *
 * The wording below is shortened to fit USSD screens. The Swahili and Sheng versions are drafts
 * that must be reviewed by the clinical lead and validated before clinical use. See
 * docs/clinical-content.md.
 */

/**
 * Whether answering "a lot" means the user is doing well (positive) or has the symptom
 * (symptom). Used to interpret free-text answers on WhatsApp.
 */
export type ItemPolarity = "positive" | "symptom";

export interface EpdsOption {
  readonly label: Localized;
  /** Score from 0 (no symptom) to 3 (most severe), as defined by the EPDS. */
  readonly score: 0 | 1 | 2 | 3;
}

export interface EpdsItem {
  readonly id: number;
  readonly polarity: ItemPolarity;
  readonly question: Localized;
  readonly options: readonly [EpdsOption, EpdsOption, EpdsOption, EpdsOption];
}

const opt = (score: EpdsOption["score"], sheng: string, sw: string, en: string): EpdsOption => ({
  score,
  label: { sheng, sw, en },
});

export const EPDS_ITEMS: readonly EpdsItem[] = [
  {
    id: 1,
    polarity: "positive",
    question: {
      sheng: "Umeweza kucheka na kuenjoy vitu za kuchekesha?",
      sw: "Umeweza kucheka na kuona mambo ya kuchekesha?",
      en: "Have you been able to laugh and see the funny side of things?",
    },
    options: [
      opt(0, "Kama kawaida", "Kama kawaida", "As much as always"),
      opt(1, "Kiasi tu", "Kidogo kuliko kawaida", "Not quite so much"),
      opt(2, "Kidogo sana", "Kidogo sana", "Definitely less"),
      opt(3, "Hata kidogo", "Hapana kabisa", "Not at all"),
    ],
  },
  {
    id: 2,
    polarity: "positive",
    question: {
      sheng: "Umekuwa ukingoja vitu kwa furaha?",
      sw: "Umetarajia mambo kwa furaha?",
      en: "Have you looked forward with enjoyment to things?",
    },
    options: [
      opt(0, "Kama kawaida", "Kama kawaida", "As much as ever"),
      opt(1, "Kiasi tu", "Kidogo kuliko zamani", "Rather less than before"),
      opt(2, "Kidogo sana", "Kidogo sana", "Definitely less"),
      opt(3, "Hata kidogo", "Karibu hapana", "Hardly at all"),
    ],
  },
  {
    id: 3,
    polarity: "symptom",
    question: {
      sheng: "Umekuwa ukijiblame bure vitu zikienda vibaya?",
      sw: "Umejilaumu bila sababu mambo yakienda vibaya?",
      en: "Have you blamed yourself unnecessarily when things went wrong?",
    },
    options: [
      opt(3, "Mara mob", "Ndio, mara nyingi", "Yes, most of the time"),
      opt(2, "Saa zingine", "Ndio, wakati mwingine", "Yes, some of the time"),
      opt(1, "Si sana", "Si mara nyingi", "Not very often"),
      opt(0, "Never", "Hapana, kamwe", "No, never"),
    ],
  },
  {
    id: 4,
    polarity: "symptom",
    question: {
      sheng: "Umekuwa na stress ama wasiwasi bila sababu?",
      sw: "Umekuwa na wasiwasi bila sababu nzuri?",
      en: "Have you been anxious or worried for no good reason?",
    },
    options: [
      opt(0, "Never", "Hapana kabisa", "No, not at all"),
      opt(1, "Mara chache", "Mara chache sana", "Hardly ever"),
      opt(2, "Saa zingine", "Ndio, wakati mwingine", "Yes, sometimes"),
      opt(3, "Mara mob", "Ndio, mara nyingi", "Yes, very often"),
    ],
  },
  {
    id: 5,
    polarity: "symptom",
    question: {
      sheng: "Umekuwa ukiogopa ama kupanick bila sababu?",
      sw: "Umeogopa au kushtuka bila sababu nzuri?",
      en: "Have you felt scared or panicky for no good reason?",
    },
    options: [
      opt(3, "Sana", "Ndio, sana", "Yes, quite a lot"),
      opt(2, "Saa zingine", "Ndio, wakati mwingine", "Yes, sometimes"),
      opt(1, "Si sana", "Hapana, si sana", "No, not much"),
      opt(0, "Never", "Hapana kabisa", "No, not at all"),
    ],
  },
  {
    id: 6,
    polarity: "symptom",
    question: {
      sheng: "Mambo imekuwa mob, huwezi cope?",
      sw: "Mambo yamekulemea?",
      en: "Have things been getting on top of you?",
    },
    options: [
      opt(3, "Siwezi kabisa", "Ndio, sijaweza kabisa", "Yes, not coping at all"),
      opt(2, "Saa zingine", "Ndio, wakati mwingine", "Yes, sometimes"),
      opt(1, "Nacope poa", "Hapana, nimeweza vizuri", "No, mostly coping well"),
      opt(0, "Niko fiti", "Hapana, kama kawaida", "No, coping as well as ever"),
    ],
  },
  {
    id: 7,
    polarity: "symptom",
    question: {
      sheng: "Umekuwa na huzuni mpaka hulali?",
      sw: "Umekuwa na huzuni hadi kukosa usingizi?",
      en: "Have you been so unhappy that you have had difficulty sleeping?",
    },
    options: [
      opt(3, "Mara mob", "Ndio, mara nyingi", "Yes, most of the time"),
      opt(2, "Saa zingine", "Ndio, wakati mwingine", "Yes, sometimes"),
      opt(1, "Si sana", "Si mara nyingi", "Not very often"),
      opt(0, "Never", "Hapana kabisa", "No, not at all"),
    ],
  },
  {
    id: 8,
    polarity: "symptom",
    question: {
      sheng: "Umekuwa ukifeel sad ama low?",
      sw: "Umejisikia huzuni au mnyonge?",
      en: "Have you felt sad or miserable?",
    },
    options: [
      opt(3, "Mara mob", "Ndio, mara nyingi", "Yes, most of the time"),
      opt(2, "Saa zingine", "Ndio, mara kwa mara", "Yes, quite often"),
      opt(1, "Si sana", "Si mara nyingi", "Not very often"),
      opt(0, "Never", "Hapana kabisa", "No, not at all"),
    ],
  },
  {
    id: 9,
    polarity: "symptom",
    question: {
      sheng: "Umekuwa na huzuni mpaka kulia?",
      sw: "Umekuwa na huzuni hadi kulia?",
      en: "Have you been so unhappy that you have been crying?",
    },
    options: [
      opt(3, "Mara mob", "Ndio, mara nyingi", "Yes, most of the time"),
      opt(2, "Saa zingine", "Ndio, mara kwa mara", "Yes, quite often"),
      opt(1, "Mara moja moja", "Mara moja moja", "Only occasionally"),
      opt(0, "Never", "Hapana, kamwe", "No, never"),
    ],
  },
  {
    id: 10,
    polarity: "symptom",
    question: {
      sheng: "Umewahi waza kujiumiza?",
      sw: "Umewahi kuwaza kujiumiza?",
      en: "Has the thought of harming yourself occurred to you?",
    },
    options: [
      opt(3, "Mara mob", "Ndio, mara nyingi", "Yes, quite often"),
      opt(2, "Saa zingine", "Wakati mwingine", "Sometimes"),
      opt(1, "Mara chache", "Mara chache sana", "Hardly ever"),
      opt(0, "Never", "Kamwe", "Never"),
    ],
  },
];

/** EPDS item 10 asks about self-harm; any non-zero answer needs same-day human follow-up. */
export const SELF_HARM_ITEM_INDEX = 9;

export const EPDS_MAX_SCORE = 30;

/** Total EPDS score for a full set of 10 option indexes (0-3, in display order). */
export function scoreEpds(optionIndexes: readonly number[]): number {
  if (optionIndexes.length !== EPDS_ITEMS.length) {
    throw new RangeError(`EPDS needs ${EPDS_ITEMS.length} answers, got ${optionIndexes.length}`);
  }
  return optionIndexes.reduce((total, optionIndex, itemIndex) => {
    return total + optionScore(itemIndex, optionIndex);
  }, 0);
}

/** Score of one answered option. */
export function optionScore(itemIndex: number, optionIndex: number): number {
  const option = EPDS_ITEMS[itemIndex]?.options[optionIndex];
  if (option === undefined) {
    throw new RangeError(`No EPDS option ${optionIndex} for item ${itemIndex}`);
  }
  return option.score;
}
