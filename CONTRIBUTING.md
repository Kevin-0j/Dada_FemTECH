# Contributing to Dada

Thank you for helping. Dada is used by women at a vulnerable time, so we ask every contributor to
put their safety first, ahead of speed or new features.

## Ways to help

- **Wording and translation.** If you speak Sheng or Swahili and something sounds wrong, open an
  issue with the "Wording or translation" template. This is one of the most useful things you can
  do.
- **Bugs.** Open an issue with steps to reproduce. Never paste real phone numbers or anything a
  user typed.
- **Code.** Pick an open issue, or open one first to discuss a bigger change.

## Setting up

You need Node.js 22.18 or newer.

```bash
git clone https://github.com/Kevin-0j/Dada_FemTECH.git
cd Dada_FemTECH
npm install
npm run setup          # creates .env with fresh keys
npm run dev
```

## Before you open a pull request

Run the full check. CI runs the same thing.

```bash
npm run check
```

It type-checks, lints, checks formatting and runs the tests with coverage thresholds.

## How the code is organised

Dependencies only point inwards:

```
adapters  ->  application  ->  domain
     \            |
      `-->  contracts (interfaces)
```

- `src/domain` is pure logic: the questionnaire, scoring, risk and the conversation. No input or
  output, no clock, no randomness. Most changes to behaviour start here.
- `src/contracts` holds the interfaces the application needs (storage, encryption, interpreters).
- `src/application` runs the use cases: handle a message, list referrals, build statistics.
- `src/adapters` talks to the outside world: HTTP, SQLite, crypto, language models, webhooks.
- `src/compose.ts` wires everything together. `src/main.ts` starts the server.

More detail is in [docs/architecture.md](docs/architecture.md).

## Rules we hold to

- **Validate at the edge.** Anything from a request, the environment or a database row is parsed
  with `zod` before use.
- **No `any`, no non-null assertions, no unchecked casts.** TypeScript runs in strict mode with
  `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **Test through real seams.** Tests use an in-memory SQLite database, real HTTP requests to the app
  and small local HTTP servers instead of module mocks.
- **Never log personal data.** No phone numbers, names or message text in logs, errors or
  notifications.
- **Keep USSD screens under 182 characters.** The tests check every screen in every language.
- **Clinical changes need clinical review.** Changes to the questionnaire, the cut-offs, the
  danger phrases or the safety messages need approval from the clinical lead (see
  [SAFEGUARDING.md](SAFEGUARDING.md)).

## Commits and pull requests

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Luo language option
fix(ussd): keep the exit option on the area screen
docs: explain how to rotate the encryption key
```

Pull request titles follow the same format. Fill in the pull request template.

## Using AI tools

You may use AI coding tools. A person must read and understand the whole change before opening the
pull request, and that person is responsible for it. Do not let a tool claim a review that a person
did not do.

## Code of conduct

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
