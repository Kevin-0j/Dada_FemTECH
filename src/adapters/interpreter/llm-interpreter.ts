import { z } from "zod";
import type { AnswerInterpreter, InterpretRequest } from "../../contracts/ports.ts";
import { EPDS_ITEMS } from "../../domain/epds.ts";

export interface LlmInterpreterOptions {
  /** Base URL of an OpenAI-compatible API, e.g. a self-hosted vLLM or Ollama server. */
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string | null;
  readonly timeoutMs: number;
  readonly fetch?: typeof fetch;
}

const completionResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

const answer = z.object({ option: z.number().int().min(1).max(4).nullable() });

/**
 * Asks a language model which option a free-text answer matches. Only the answer text and the
 * question are sent, never a phone number. The model can only pick an option or say it is not
 * sure; it never decides risk, and danger phrases are handled before it is called.
 */
export class LlmInterpreter implements AnswerInterpreter {
  readonly #options: LlmInterpreterOptions;
  readonly #fetch: typeof fetch;

  constructor(options: LlmInterpreterOptions) {
    this.#options = options;
    this.#fetch = options.fetch ?? fetch;
  }

  async interpret({ itemIndex, language, text }: InterpretRequest): Promise<number | null> {
    const item = EPDS_ITEMS[itemIndex];
    if (item === undefined) return null;

    const options = item.options
      .map((option, index) => `${index + 1}. ${option.label[language]} / ${option.label.en}`)
      .join("\n");
    const system = [
      "You map a mother's reply to one option of a screening question.",
      "Replies may be in Sheng, Swahili or English.",
      'Answer with JSON only: {"option": N} where N is 1-4, or {"option": null} if unsure.',
      "Never guess. If the reply is off-topic or unclear, answer null.",
    ].join(" ");
    const user = `Question: ${item.question.en}\nOptions:\n${options}\nReply: ${text}`;

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.#options.apiKey !== null) headers["authorization"] = `Bearer ${this.#options.apiKey}`;

    try {
      const response = await this.#fetch(
        `${this.#options.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(this.#options.timeoutMs),
          body: JSON.stringify({
            model: this.#options.model,
            temperature: 0,
            max_tokens: 20,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        },
      );
      if (!response.ok) return null;
      const body = completionResponse.parse(await response.json());
      const content = body.choices[0]?.message.content ?? "";
      const json = /\{[^}]*\}/.exec(content)?.[0];
      if (json === undefined) return null;
      const parsed = answer.parse(JSON.parse(json));
      return parsed.option === null ? null : parsed.option - 1;
    } catch {
      // Any failure falls back to asking the user to reply with a number.
      return null;
    }
  }
}

/** Tries each interpreter in order and returns the first confident answer. */
export class ChainInterpreter implements AnswerInterpreter {
  readonly #interpreters: readonly AnswerInterpreter[];

  constructor(interpreters: readonly AnswerInterpreter[]) {
    this.#interpreters = interpreters;
  }

  async interpret(request: InterpretRequest): Promise<number | null> {
    for (const interpreter of this.#interpreters) {
      const result = await interpreter.interpret(request);
      if (result !== null) return result;
    }
    return null;
  }
}
