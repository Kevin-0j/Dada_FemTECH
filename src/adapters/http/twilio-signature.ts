import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks Twilio's X-Twilio-Signature header: base64 HMAC-SHA1 of the full request URL followed
 * by every POST parameter name and value, sorted by name.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function isValidTwilioSignature(
  authToken: string,
  url: string,
  params: Readonly<Record<string, string>>,
  signature: string,
): boolean {
  const payload = Object.keys(params)
    .toSorted()
    .reduce((acc, key) => acc + key + (params[key] ?? ""), url);
  const expected = createHmac("sha1", authToken).update(payload, "utf8").digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
