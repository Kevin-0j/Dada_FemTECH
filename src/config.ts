import { z } from "zod";

/**
 * The single place environment variables are read and checked. Every variable is documented in
 * .env.example; keep the two in step.
 */

const base64Key = (minBytes: number) =>
  z
    .string()
    .transform((value) => Buffer.from(value, "base64"))
    .refine((key) => key.length >= minBytes, `must decode to at least ${minBytes} bytes`);

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === "" ? null : value.trim()));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    PUBLIC_BASE_URL: z.url(),
    DATABASE_PATH: z.string().min(1).default("./data/dada.db"),
    ENCRYPTION_KEY: base64Key(32).refine((key) => key.length === 32, "must decode to 32 bytes"),
    HASH_KEY: base64Key(32),
    USSD_CALLBACK_KEY: z.string().min(16),
    TWILIO_AUTH_TOKEN: optionalString,
    STAFF_USER: z.string().min(3),
    STAFF_PASSWORD: z.string().min(12),
    WARDS: z
      .string()
      .default("Kangemi,Dagoretti")
      .transform((value) =>
        value
          .split(",")
          .map((ward) => ward.trim())
          .filter((ward) => ward.length > 0),
      ),
    EPDS_POSSIBLE: z.coerce.number().int().min(0).max(30).default(10),
    EPDS_PROBABLE: z.coerce.number().int().min(0).max(30).default(13),
    SESSION_TTL_MINUTES: z.coerce.number().int().min(1).max(240).default(30),
    RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    WHATSAPP_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(20),
    STATS_SUPPRESSION: z.coerce.number().int().min(1).max(100).default(5),
    LLM_BASE_URL: optionalString,
    LLM_MODEL: optionalString,
    LLM_API_KEY: optionalString,
    LLM_TIMEOUT_MS: z.coerce.number().int().min(500).max(10000).default(4000),
    REFERRAL_WEBHOOK_URL: optionalString,
    DEMO_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .refine((env) => env.EPDS_POSSIBLE <= env.EPDS_PROBABLE, {
    message: "EPDS_POSSIBLE must not be greater than EPDS_PROBABLE",
    path: ["EPDS_POSSIBLE"],
  })
  .refine((env) => env.NODE_ENV !== "production" || env.TWILIO_AUTH_TOKEN !== null, {
    message: "TWILIO_AUTH_TOKEN is required in production so WhatsApp requests can be verified",
    path: ["TWILIO_AUTH_TOKEN"],
  })
  .refine((env) => !(env.NODE_ENV === "production" && env.DEMO_MODE), {
    message: "DEMO_MODE cannot be used in production",
    path: ["DEMO_MODE"],
  })
  .refine((env) => (env.LLM_BASE_URL === null) === (env.LLM_MODEL === null), {
    message: "Set both LLM_BASE_URL and LLM_MODEL, or neither",
    path: ["LLM_MODEL"],
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration is not valid:\n${problems}\nSee .env.example.`);
  }
  return result.data;
}
