/**
 * Creates .env from .env.example with fresh random keys and a staff password, so the server can
 * start on a laptop without editing anything by hand.
 *
 *   npm run setup            fresh keys, demo mode off
 *   npm run setup -- --demo  same, with DEMO_MODE=true for recording a demo
 *
 * Refuses to overwrite an existing .env, because that would make stored phone numbers unreadable.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env")) {
  console.error(".env already exists. Delete it first if you really want new keys.");
  process.exit(1);
}

const demo = process.argv.includes("--demo");
const password = randomBytes(12).toString("base64url");
const values: Record<string, string> = {
  ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  HASH_KEY: randomBytes(32).toString("base64"),
  USSD_CALLBACK_KEY: randomBytes(24).toString("base64url"),
  STAFF_PASSWORD: password,
  DEMO_MODE: demo ? "true" : "false",
};

const lines = readFileSync(".env.example", "utf8")
  .split("\n")
  .map((line) => {
    const name = line.split("=", 1)[0] ?? "";
    return name in values && !line.startsWith("#") ? `${name}=${values[name]}` : line;
  });
writeFileSync(".env", lines.join("\n"), { mode: 0o600 });

console.info(`Created .env${demo ? " in demo mode" : ""}.`);
console.info(`Staff login for http://localhost:3000/staff: counsellor / ${password}`);
