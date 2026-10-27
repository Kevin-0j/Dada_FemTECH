/** Languages a user can choose. Sheng is the default because most target users speak it daily. */
export const LANGUAGES = ["sheng", "sw", "en"] as const;

export type Language = (typeof LANGUAGES)[number];

/** A string available in every supported language. */
export type Localized = Readonly<Record<Language, string>>;
