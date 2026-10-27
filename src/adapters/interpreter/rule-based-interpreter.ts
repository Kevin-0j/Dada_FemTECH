import type { AnswerInterpreter, InterpretRequest } from "../../contracts/ports.ts";
import { EPDS_ITEMS, type ItemPolarity } from "../../domain/epds.ts";
import { normalizeText } from "../../domain/safety.ts";

type Score = 0 | 1 | 2 | 3;

/**
 * Phrase lists in priority order: the first phrase that matches decides the score. Longer,
 * more specific phrases come first so that "si sana" (not much) wins over "sana" (a lot), and
 * "hapana kabisa" (not at all) wins over "kabisa".
 */
const SYMPTOM_PHRASES: ReadonlyArray<readonly [Score, readonly string[]]> = [
  [0, ["hapana kabisa", "hata kidogo", "not at all", "no never", "hapana kamwe"]],
  [1, ["si sana", "sio sana", "not much", "not very often", "mara chache", "mara moja moja"]],
  [2, ["wakati mwingine", "saa zingine", "mara kwa mara", "quite often", "some of the time"]],
  [3, ["mara nyingi", "mara mob", "kila saa", "kila siku", "most of the time", "a lot"]],
  [3, ["very often", "all the time", "kila wakati"]],
  [0, ["never", "kamwe", "sijawahi", "hapana", "no", "la"]],
  [1, ["rarely", "hardly", "occasionally", "kidogo", "chache"]],
  // A bare "yes" says the symptom is there but not how often, so it scores as "sometimes".
  [2, ["sometimes", "kiasi", "yes", "ndio", "ndiyo"]],
  [3, ["sana", "always", "mob"]],
];

/** For items where "a lot" is good (laughing, looking forward), scores run the other way. */
const POSITIVE_PHRASES: ReadonlyArray<readonly [Score, readonly string[]]> = [
  [3, ["hata kidogo", "hapana kabisa", "not at all", "hardly at all", "karibu hapana"]],
  [2, ["kidogo sana", "definitely less", "very little", "much less"]],
  [1, ["si sana", "sio sana", "not quite", "kiasi tu", "a bit less", "less than before"]],
  [0, ["kama kawaida", "as much as", "as usual", "kama zamani"]],
  [3, ["never", "kamwe", "hapana", "no"]],
  [1, ["kiasi", "kidogo", "less"]],
  [0, ["sana", "yes", "ndio", "ndiyo", "always", "poa", "fiti"]],
];

const PHRASES: Readonly<Record<ItemPolarity, ReadonlyArray<readonly [Score, readonly string[]]>>> =
  {
    symptom: SYMPTOM_PHRASES,
    positive: POSITIVE_PHRASES,
  };

/**
 * Understands everyday Sheng, Swahili and English answers without any network call. It is the
 * first and default interpreter; a language model is only asked when this returns null.
 */
export class RuleBasedInterpreter implements AnswerInterpreter {
  interpret(request: InterpretRequest): Promise<number | null> {
    return Promise.resolve(this.interpretSync(request));
  }

  interpretSync({ itemIndex, text }: InterpretRequest): number | null {
    const item = EPDS_ITEMS[itemIndex];
    if (item === undefined) return null;
    const normalized = ` ${normalizeText(text)} `;
    for (const [score, phrases] of PHRASES[item.polarity]) {
      if (phrases.some((phrase) => normalized.includes(` ${phrase} `))) {
        const index = item.options.findIndex((option) => option.score === score);
        return index === -1 ? null : index;
      }
    }
    return null;
  }
}
