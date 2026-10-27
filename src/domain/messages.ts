import type { Language, Localized } from "./language.ts";
import type { RiskTier } from "./risk.ts";

/**
 * All user-facing copy outside the questionnaire. Swahili and Sheng are drafts pending review by
 * the clinical lead and community testers (docs/clinical-content.md). Keep every screen short:
 * USSD shows at most 182 characters.
 */

/** Shown before a language is chosen, so it mixes languages. */
export const LANGUAGE_MENU = "Karibu Dada.\n1 Sheng\n2 Kiswahili\n3 English\n0 Toka/Exit";

/** Neutral goodbye, safe for someone else to see on a shared phone. */
export const EXIT: Localized = {
  sheng: "Asante. Kwaheri.",
  sw: "Asante. Kwaheri.",
  en: "Thank you. Goodbye.",
};

export const EXIT_OPTION: Localized = { sheng: "0 Toka", sw: "0 Toka", en: "0 Exit" };

export const INVALID: Localized = {
  sheng: "Jibu na nambari kwa list.",
  sw: "Tafadhali jibu kwa nambari.",
  en: "Please reply with a number.",
};

export const CONSENT: Localized = {
  sheng:
    "Maswali 12 kuhusu vile umefeel siku 7 zimepita. Ni siri. Toka saa yoyote na 0.\n1 Endelea\n2 Hapana asante",
  sw: "Maswali 12 kuhusu hisia zako siku 7 zilizopita. Ni siri. Toka wakati wowote kwa 0.\n1 Endelea\n2 Hapana asante",
  en: "12 questions about how you felt in the past 7 days. It is private. Exit any time with 0.\n1 Continue\n2 No thanks",
};

export const OFFER: Readonly<Record<RiskTier, Localized>> = {
  low: {
    sheng:
      "Asante. Majibu yako hayaonyeshi shida kubwa. Jitunze na ongea na mtu unaamini.\n1 Nataka mtu anipigie\n2 Maliza",
    sw: "Asante. Majibu yako hayaonyeshi tatizo kubwa. Jitunze na zungumza na unayemwamini.\n1 Nataka kupigiwa\n2 Maliza",
    en: "Thank you. Your answers do not show a big problem. Look after yourself and talk to someone you trust.\n1 Call me\n2 Finish",
  },
  moderate: {
    sheng:
      "Asante kwa kushare. Unapitia mambo mob. Health promoter anaweza kukupigia na kukutembelea, bure.\n1 Ndio\n2 Hapana",
    sw: "Asante kwa kushiriki. Unapitia mengi. Mhudumu wa afya anaweza kukupigia na kukutembelea, bure.\n1 Ndio\n2 Hapana",
    en: "Thank you for sharing. You are going through a lot. A health promoter can call and visit you, free.\n1 Yes\n2 No",
  },
  high: {
    sheng:
      "Asante kwa kushare. Counsellor anaweza kukupigia akusaidie, bure na kwa siri.\n1 Ndio, nipigie\n2 Hapana",
    sw: "Asante kwa kushiriki. Mshauri anaweza kukupigia akusaidie, bure na kwa siri.\n1 Ndio, nipigie\n2 Hapana",
    en: "Thank you for sharing. A counsellor can call you to help, free and private.\n1 Yes, call me\n2 No",
  },
  urgent: {
    sheng:
      "Usalama wako ni muhimu. Dharura: 999 ama 112. GBV: 1195 bure. Counsellor akupigie leo?\n1 Ndio\n2 Hapana",
    sw: "Usalama wako ni muhimu. Dharura: 999 au 112. GBV: 1195 bure. Mshauri akupigie leo?\n1 Ndio\n2 Hapana",
    en: "Your safety matters. Emergency: 999 or 112. GBV: 1195 free. Can a counsellor call you today?\n1 Yes\n2 No",
  },
};

export const DANGER_INTERRUPT: Localized = {
  sheng:
    "Tunataka uwe safe. Kama ni dharura piga 999 ama 112. GBV: 1195 bure. Counsellor akupigie sasa?\n1 Ndio\n2 Hapana",
  sw: "Tunataka uwe salama. Kama ni dharura piga 999 au 112. GBV: 1195 bure. Mshauri akupigie sasa?\n1 Ndio\n2 Hapana",
  en: "We want you to be safe. In an emergency call 999 or 112. GBV: 1195 free. Can a counsellor call you now?\n1 Yes\n2 No",
};

export const CALLBACK_CHOICE: Localized = {
  sheng: "Tukupigie kwa namba hii?\n1 Ndio\n2 Namba ingine\n3 Usinipigie",
  sw: "Tukupigie kwa namba hii?\n1 Ndio\n2 Namba nyingine\n3 Usinipigie",
  en: "Shall we call this number?\n1 Yes\n2 Another number\n3 Do not call",
};

export const CALLBACK_NUMBER: Localized = {
  sheng: "Weka namba ya simu, mfano 0712345678",
  sw: "Andika namba ya simu, mfano 0712345678",
  en: "Enter a phone number, e.g. 0712345678",
};

export const INVALID_PHONE: Localized = {
  sheng: "Namba hiyo si sawa.",
  sw: "Namba hiyo si sahihi.",
  en: "That number is not valid.",
};

export const WARD_QUESTION: Localized = {
  sheng: "Unaishi area gani?",
  sw: "Unaishi eneo gani?",
  en: "Which area do you live in?",
};

export const OTHER_WARD: Localized = { sheng: "Pengine", sw: "Pengine", en: "Other" };

export const REFERRAL_DONE: Readonly<Record<"today" | "soon", Localized>> = {
  today: {
    sheng: "Asante. Counsellor atakupigia leo. Dharura: 999 ama 112. GBV: 1195 bure.",
    sw: "Asante. Mshauri atakupigia leo. Dharura: 999 au 112. GBV: 1195 bure.",
    en: "Thank you. A counsellor will call you today. Emergency: 999 or 112. GBV: 1195 free.",
  },
  soon: {
    sheng: "Asante. Mtu wa Dada atakupigia siku chache zijazo. GBV: 1195 bure.",
    sw: "Asante. Mhudumu wa Dada atakupigia ndani ya siku chache. GBV: 1195 bure.",
    en: "Thank you. Someone from Dada will call you within a few days. GBV: 1195 free.",
  },
};

export const NO_REFERRAL: Localized = {
  sheng: "Sawa. Ukihitaji msaada baadaye, rudi Dada. GBV: 1195 bure. Dharura: 999.",
  sw: "Sawa. Ukihitaji msaada baadaye, rudi Dada. GBV: 1195 bure. Dharura: 999.",
  en: "Okay. If you need help later, come back to Dada. GBV: 1195 free. Emergency: 999.",
};

/** Words that start the conversation again from the language menu, on any screen. */
export const RESTART_WORDS = new Set(["anza", "start", "menu", "restart", "rudi", "mwanzo"]);

/** Words that mean "yes" or "no" in free text, for yes/no screens on WhatsApp. */
export const YES_WORDS = new Set([
  "ndio",
  "ndiyo",
  "yes",
  "yeah",
  "sawa",
  "ok",
  "okay",
  "poa",
  "eh",
]);
export const NO_WORDS = new Set(["hapana", "no", "la", "aih", "apana", "sitaki"]);

export function t(text: Localized, language: Language): string {
  return text[language];
}
