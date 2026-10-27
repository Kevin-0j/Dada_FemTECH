# Notes for AI coding assistants

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SAFEGUARDING.md](SAFEGUARDING.md) first. These rules
apply on top of them.

- Keep the layers: `domain` imports nothing outside itself; `application` imports `domain` and
  `contracts`; only `adapters`, `compose.ts` and `main.ts` touch I/O.
- Parse every outside value with `zod`. No `any`, non-null assertions or unchecked casts.
- Do not change questionnaire wording, cut-offs, danger phrases or safety messages unless the task
  says the clinical lead approved it. Say so in the pull request.
- Never add logging, analytics or storage that could hold a phone number, a name or message text.
- Every new behaviour needs a test. Prefer real seams (in-memory SQLite, `app.request`, a local
  HTTP server) over mocks.
- Run `npm run check` before you finish. Do not skip or weaken a test to make it pass.
- Use Conventional Commits.
- A human owner must review and take responsibility for every pull request. Do not state or imply
  that a human reviewed something.
