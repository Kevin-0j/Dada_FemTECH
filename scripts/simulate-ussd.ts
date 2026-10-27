/**
 * A USSD phone in your terminal. It talks to a running Dada server the same way Africa's
 * Talking does, so you can try the flow or record a demo without a telco account.
 *
 *   npm run dev            (in one terminal)
 *   npm run simulate       (in another)
 *
 * Reads DADA_URL (default http://localhost:3000), USSD_CALLBACK_KEY and SIM_PHONE from the
 * environment.
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const baseUrl = process.env["DADA_URL"] ?? "http://localhost:3000";
const key = process.env["USSD_CALLBACK_KEY"] ?? "";
const phoneNumber = process.env["SIM_PHONE"] ?? "+254700000001";

if (key === "") {
  console.error("Set USSD_CALLBACK_KEY to the same value the server uses (see .env).");
  process.exit(1);
}

const rl = createInterface({ input: stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();
const sessionId = `sim-${randomUUID()}`;
const answers: string[] = [];

for (;;) {
  const response = await fetch(`${baseUrl}/ussd?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      sessionId,
      serviceCode: "*384*123#",
      phoneNumber,
      text: answers.join("*"),
    }),
  });
  const body = await response.text();
  const ended = body.startsWith("END ");
  const screen = body.replace(/^(CON|END) /, "");

  stdout.write(`\n+${"-".repeat(34)}+\n`);
  for (const line of screen.split("\n")) stdout.write(`| ${line}\n`);
  stdout.write(`+${"-".repeat(34)}+\n`);

  if (ended || !response.ok) break;
  stdout.write("> ");
  const next = await lines.next();
  if (next.done === true) break;
  answers.push(String(next.value).trim());
}

rl.close();
