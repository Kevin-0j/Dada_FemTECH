# Safeguarding

Dada talks to pregnant women and new mothers about depression, self-harm and violence at home.
Some of the people who use it will be in danger. This document sets out how the software protects
them and what the team running it must do. The software alone does not make a service safe: the
people and the protocol around it do.

## Who is responsible

Every deployment must name, before going live:

| Role                 | Responsibility                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Clinical lead        | Owns the questionnaire wording, the score cut-offs, the danger phrase list and the referral protocol. Signs off any change to them.             |
| Safeguarding lead    | Owns the response to disclosures of violence and to anyone under 18. Keeps the incident log.                                                    |
| Data protection lead | Registers with the Office of the Data Protection Commissioner, completes the data protection impact assessment and handles requests from users. |
| Technical lead       | Keeps the service running, the keys safe and the backups tested.                                                                                |

One person may hold more than one role, but the clinical lead must be a qualified mental health
professional.

## What the software does

### Before anything is asked

- The user chooses a language and is told how many questions there are, that the answers are
  private and that they can leave at any time by sending 0.
- Nothing is asked until the user agrees.

### On a shared phone

- USSD leaves no message history on the handset.
- Every question screen has a "0 Toka" (exit) option, and leaving shows only a neutral
  "Asante. Kwaheri." with no mention of mental health.
- Dada never sends an SMS on its own.
- A user can ask to be called on a different number from the one she is using.

### When someone may be in danger

- Item 10 of the EPDS asks about thoughts of self-harm. Any answer other than "never" makes the
  case urgent, whatever the total score.
- Answering "no" to "Are you safe right now?" makes the case urgent.
- On WhatsApp, every message is checked against a list of danger phrases in Sheng, Swahili and
  English (for example "sitaki kuishi", "ananipiga", "kill myself") before anything else happens.
  A match stops the questionnaire and goes straight to an urgent offer of a call.
- Urgent and high-risk users are shown the emergency numbers (999 or 112) and the free national
  GBV helpline (1195) on screen.
- The AI never decides risk. Danger detection uses fixed, reviewable rules and runs before any
  language model is called.

### After screening

- The user decides whether she wants a call. Saying no is respected, and she is shown where to get
  help if she changes her mind.
- Referrals appear in the staff queue sorted with urgent cases first.
- The staff queue shows only what is needed to make the call: priority, the reasons, the score,
  the area and the phone number. It does not show individual answers, because they are never
  stored.

## What the team must do

1. Answer urgent referrals the same day. Agree a maximum time (we suggest 2 hours during clinic
   hours) and an out-of-hours plan before launch.
2. Agree a written protocol for:
   - imminent risk of suicide (when to call emergency services, who escorts the person to care);
   - disclosure of violence (consent to refer, referral to a GBV recovery centre, police only with
     consent unless a child is at risk);
   - users under 18, including Kenya's legal duties under the Children Act 2022.
3. Train every counsellor and community health promoter on the protocol before they get a login.
4. Never write what a user says into Dada. Case notes belong in the clinic's own record system.
5. Review the danger phrase list every month with community health promoters, adding the words
   people really use. Changes go through a pull request reviewed by the clinical lead.
6. Keep an incident log of anything that went wrong or nearly went wrong, and review it monthly.

## Limits we want users and partners to know about

- Dada is a screening tool. It does not diagnose and it is not treatment.
- The Swahili and Sheng wording of the EPDS is a draft until the validation study is finished (see
  [docs/clinical-content.md](docs/clinical-content.md)).
- Mobile networks keep their own logs of USSD sessions and WhatsApp keeps chat history on the
  phone. Community health promoters explain this when they introduce Dada, and suggest USSD to
  anyone who shares a phone.

## Reporting a concern

If you think Dada has put someone at risk, or could, contact the safeguarding lead for your
deployment. For problems with the software itself, follow [SECURITY.md](SECURITY.md).
