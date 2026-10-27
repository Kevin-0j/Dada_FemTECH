# Recording a demo

How to show Dada working in a short video, with no real user data.

## Set up (about 15 minutes)

1. Start the server locally with a fresh database:

   ```bash
   cp .env.example .env    # fill in keys and passwords
   npm run dev
   ```

2. Expose it over HTTPS so Africa's Talking and Twilio can reach it, for example with
   `cloudflared tunnel --url http://localhost:3000`. Put the tunnel address in `PUBLIC_BASE_URL`.
3. Point the Africa's Talking sandbox callback and the Twilio WhatsApp sandbox at the tunnel (see
   [deployment.md](deployment.md)).

4. So the dashboard is not empty, set `DEMO_MODE=true` in `.env`, run `npm run seed:demo` and
   restart. Every page then shows a "Demo data" banner. Keep it visible in the video: UNICEF
   must never think fictional numbers are pilot results.

If you cannot use the sandboxes, `npm run simulate` gives you a USSD phone in the terminal that
talks to the same server.

## Suggested two-minute script

| Time | Show              | Say                                                                                                                         |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | The team          | Who you are and who Dada is for.                                                                                            |
| 0:15 | USSD simulator    | A mother on a basic phone dials the code, picks Sheng, agrees, answers a few questions. Point out "0 Toka" on every screen. |
| 0:50 | WhatsApp          | A second mother answers in her own words ("saa zingine", "mara mob") and Dada understands.                                  |
| 1:10 | WhatsApp          | She types something that signals danger. Dada stops and offers an urgent call, with 999 and 1195.                           |
| 1:25 | Staff queue       | The urgent case is at the top. The counsellor marks it contacted.                                                           |
| 1:40 | Live numbers page | Anonymised totals that anyone, including UNICEF, can see.                                                                   |
| 1:50 | The repository    | Open source under MIT, with the safeguarding plan.                                                                          |

Use invented personas and test phone numbers only. Never record a real conversation.
