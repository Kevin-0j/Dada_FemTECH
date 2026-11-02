# Recording a demo

How to show Dada working in a short video, with no real user data.

## Set up (about 30 minutes)

You need Node.js 22.18 or newer, an [ngrok](https://ngrok.com) account, an
[Africa's Talking](https://africastalking.com) account and a [Twilio](https://www.twilio.com)
account. All three are free for this.

### 1. Start Dada with demo data

```bash
npm run setup -- --demo
npm run seed:demo
npm run dev
```

Setup prints the staff login. Every page shows a "Demo data" banner. Keep it visible in the
video: UNICEF must never think fictional numbers are pilot results.

### 2. Give it a public HTTPS address with ngrok

Africa's Talking and Twilio cannot reach `localhost`, so ngrok forwards a public address to your
laptop.

```bash
brew install ngrok                       # macOS; see ngrok.com/download for others
ngrok config add-authtoken YOUR_NGROK_TOKEN
ngrok http 3000
```

Use the free static domain from the ngrok dashboard (**Domains**) so the address stays the same
every time you restart:

```bash
ngrok http --url=your-name.ngrok-free.app 3000
```

Put that address in `.env` and restart `npm run dev`:

```
PUBLIC_BASE_URL=https://your-name.ngrok-free.app
```

Check it from any browser: `https://your-name.ngrok-free.app/health` should show
`{"status":"ok"}`.

### 3. Connect the USSD sandbox (Africa's Talking)

1. Log in, open the **Sandbox** app, then **USSD > Create channel**. Africa's Talking gives you a
   code such as `*384*12270#`.
2. Set the callback URL to the ngrok address, `/ussd`, and your key:

   ```
   https://your-name.ngrok-free.app/ussd?key=YOUR_USSD_CALLBACK_KEY
   ```

   The key is `USSD_CALLBACK_KEY` in `.env`. The parameter must be called `key`. Leave
   **Events URL** empty.

3. Open the [simulator](https://simulator.africastalking.com), enter a Kenyan test number, open
   the phone's USSD dialler and dial the code.

Sandbox codes only work in the simulator, not on a real SIM card. A live code comes later, through
Africa's Talking and the mobile networks.

### 4. Connect the WhatsApp sandbox (Twilio)

1. In the Twilio console open **Messaging > Try it out > Send a WhatsApp message**.
2. From your phone, send the join phrase shown there (for example `join two-words`) to the
   sandbox number, +1 415 523 8886.
3. Open **Sandbox settings**. Set **When a message comes in** to the address below, method
   **POST**, and save:

   ```
   https://your-name.ngrok-free.app/whatsapp
   ```

4. Send "Habari" to the sandbox number. Dada answers.

For the recording you can leave `TWILIO_AUTH_TOKEN` empty, which skips the signature check while
`NODE_ENV=development`. Set it before any real pilot; production refuses to start without it.

### If something does not answer

| What you see                                    | Likely cause                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| USSD says the service is unavailable            | Wrong or missing `?key=` in the callback, or ngrok is not running                          |
| WhatsApp is silent and the log shows `403`      | `TWILIO_AUTH_TOKEN` is set but `PUBLIC_BASE_URL` does not match                            |
| Nothing at all appears in the `npm run dev` log | The callback still points at an old ngrok address                                          |
| Twilio replies "Failed to join sandbox"         | The phone uses a WhatsApp username, so its number is hidden; join from a phone without one |

If you cannot use the sandboxes, `npm run simulate` gives you a USSD phone in the terminal that
talks to the same server.

## Suggested two-minute script

| Time | Show              | Say                                                                                                                              |
| ---- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | The team          | Who you are and who Dada is for.                                                                                                 |
| 0:15 | USSD simulator    | A mother on a basic phone dials `*384*12270#`, picks Sheng, agrees, answers a few questions. Point out "0 Toka" on every screen. |
| 0:50 | WhatsApp          | A second mother answers in her own words ("saa zingine", "mara mob") and Dada understands.                                       |
| 1:10 | WhatsApp          | She types something that signals danger. Dada stops and offers an urgent call, with 999 and 1195.                                |
| 1:25 | Staff queue       | The urgent case is at the top, with how long she has waited. The counsellor marks it contacted.                                  |
| 1:40 | Live numbers page | The new screening appears in the daily chart. Anonymised totals anyone can see.                                                  |
| 1:50 | The repository    | Open source under MIT, with the safeguarding plan.                                                                               |

Use invented personas and test phone numbers only. Never record a real conversation.
