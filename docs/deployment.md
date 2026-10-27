# Deploying Dada

This guide takes you from an empty server to a working USSD code and WhatsApp number.

## 1. Run the server

Any host that runs Node.js 22.18 or newer, or Docker, will do. Dada needs one small machine (512 MB
of memory is plenty for a pilot) and a disk for the database.

With Docker:

```bash
docker build -t dada .
docker run -d --name dada --restart unless-stopped \
  --env-file .env -p 3000:3000 -v dada-data:/app/data dada
```

Without Docker:

```bash
npm ci --omit=dev
NODE_ENV=production node --env-file=.env src/main.ts
```

Put the server behind HTTPS (for example Caddy, nginx with Let's Encrypt, or your host's load
balancer) and set `PUBLIC_BASE_URL` to the HTTPS address.

Check it is up:

```bash
curl https://your-domain/health
```

## 2. Connect USSD with Africa's Talking

1. Create an account at [africastalking.com](https://africastalking.com) and open the sandbox.
2. Under **USSD**, create a channel (in the sandbox you get a shared code such as `*384*123#`).
3. Set the callback URL to `https://your-domain/ussd?key=YOUR_USSD_CALLBACK_KEY`.
4. Test with the Africa's Talking simulator in your browser.
5. For a live code, apply for a dedicated or shared code through Africa's Talking. Allow a few weeks
   for approval by the mobile networks.

## 3. Connect WhatsApp with Twilio

1. Create a Twilio account and open **Messaging > Try it out > Send a WhatsApp message** to use the
   sandbox.
2. Set **When a message comes in** to `https://your-domain/whatsapp` (HTTP POST).
3. Copy the auth token into `TWILIO_AUTH_TOKEN`.
4. Join the sandbox from your phone and send any message.
5. For a live number, register a WhatsApp Business sender through Twilio. Meta must approve the
   business.

## 4. Staff access

Give the staff URL `https://your-domain/staff` and the password only to trained counsellors and
community health promoter supervisors. Change the password when someone leaves.

To alert the duty counsellor, set `REFERRAL_WEBHOOK_URL` to an incoming webhook for Slack, Microsoft
Teams or Google Chat.

## 5. Optional: a language model for free text

The built-in rules handle most WhatsApp replies. To help with the rest, point `LLM_BASE_URL` and
`LLM_MODEL` at any OpenAI-compatible endpoint. A self-hosted open model (served with vLLM, Ollama or
similar) keeps all text on your own server. Check the model's licence before using it.

## 6. Backups and keys

- Back up `DATABASE_PATH` daily.
- Store `ENCRYPTION_KEY` and `HASH_KEY` in a secret manager, separately from the backups.
- Test a restore before the pilot starts.

## 7. Before going live

Work through the "What the team must do" list in [SAFEGUARDING.md](../SAFEGUARDING.md), and
register with the Office of the Data Protection Commissioner.
