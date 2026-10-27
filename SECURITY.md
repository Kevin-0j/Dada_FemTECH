# Security policy

Dada handles sensitive health information about women and girls. We take reports seriously and
will work with you to fix problems before they are made public.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting instead: go to the
**Security** tab of this repository and choose **Report a vulnerability**.

Tell us what you found, how to reproduce it and what an attacker could do with it. We will reply
within 5 working days and keep you updated until it is fixed. We are happy to credit you.

## What we protect and how

| Data                                                 | Where it lives                              | Protection                                                                      |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Answers to the questionnaire                         | Server memory, during the conversation only | Never written to disk. Forgotten after the session timeout or a restart.        |
| Phone number for a callback                          | SQLite database                             | Encrypted with AES-256-GCM. The key lives in the environment, not the database. |
| WhatsApp number during a conversation                | Server memory                               | Used as a key only after an HMAC-SHA256 hash with a secret key.                 |
| Screening results (risk level, score, channel, time) | SQLite database                             | No identifiers attached.                                                        |
| Public statistics                                    | `/stats` and `/stats.json`                  | Counts below a threshold (default 5) are hidden.                                |

Other measures:

- Africa's Talking requests must carry a secret key in the callback URL.
- Twilio requests are checked against the `X-Twilio-Signature` header. The server refuses to start
  in production without the Twilio auth token.
- Every request body is validated before use.
- The staff queue uses HTTP Basic authentication over HTTPS, rejects cross-site form posts and is
  never cached.
- Security headers are set on every response.
- Contacted referrals are deleted after the retention period (default 90 days).
- The language model, if one is used, receives only the question and the answer text. Never a
  phone number.

## Running it safely

- Always serve Dada over HTTPS.
- Generate keys with a secure random source (see `.env.example`) and keep them in a secret manager.
- Back up the database and the encryption key separately. Losing the key makes stored phone
  numbers unreadable, which is safe but means callbacks are lost.
- Give staff logins only to trained people, and change the password when someone leaves.
- If you use a language model, prefer one you host yourself.

## Supported versions

Only the latest release on `main` receives security fixes.
