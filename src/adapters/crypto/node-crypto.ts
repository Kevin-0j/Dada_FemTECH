import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { Cipher, Hasher } from "../../contracts/ports.ts";

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** AES-256-GCM. Output is base64url of iv | tag | ciphertext. */
export class AesGcmCipher implements Cipher {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new RangeError("Encryption key must be 32 bytes");
    this.#key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  }

  decrypt(encoded: string): string {
    const data = Buffer.from(encoded, "base64url");
    const iv = data.subarray(0, IV_BYTES);
    const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", this.#key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(data.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  }
}

/** HMAC-SHA256, so the same number always maps to the same key without being stored. */
export class HmacHasher implements Hasher {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.length < 32) throw new RangeError("Hash key must be at least 32 bytes");
    this.#key = key;
  }

  hash(value: string): string {
    return createHmac("sha256", this.#key).update(value).digest("base64url");
  }
}
