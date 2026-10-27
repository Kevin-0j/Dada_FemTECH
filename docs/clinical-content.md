# Clinical content

This page explains where Dada's questions come from, what has and has not been validated, and how
wording changes are made.

## The questionnaire

Dada uses the Edinburgh Postnatal Depression Scale (EPDS), a 10-item self-report questionnaire
for depression during pregnancy and after birth.

> Cox, J.L., Holden, J.M. and Sagovsky, R. (1987). Detection of postnatal depression: development
> of the 10-item Edinburgh Postnatal Depression Scale. _British Journal of Psychiatry_, 150,
> 782-786.

The EPDS may be reproduced without permission as long as the source is cited. The EPDS has been
used in Kenyan research, and a Kiswahili translation has been published.

Each item is scored 0 to 3, for a total of 0 to 30. Items 1, 2 and 4 are scored in the order shown;
items 3 and 5 to 10 are scored in reverse. This is encoded in `src/domain/epds.ts` and checked by
the tests.

## Validation status

| Version                     | Status                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| English, shortened for USSD | Shortened from the published wording to fit 182-character screens. Needs clinical sign-off.                                          |
| Swahili                     | Draft. To be checked against the published Kiswahili translation and reviewed by the clinical lead.                                  |
| Sheng                       | Draft, written for everyday speech in Nairobi's informal settlements. Must be tested with mothers and reviewed by the clinical lead. |

**Until the validation study is complete, Dada's scores must be treated as screening signals that
start a conversation with a trained person, never as a diagnosis.**

## Planned validation

1. Cognitive interviews with about 30 mothers in the pilot areas to check that each Sheng and
   Swahili question is understood as intended.
2. A comparison of Dada's score with a clinician's assessment for the same women, to set local
   cut-offs and measure sensitivity and specificity.
3. Results published openly, along with the final wording.

## Cut-offs

| Setting         | Default | Meaning                                                        |
| --------------- | ------- | -------------------------------------------------------------- |
| `EPDS_POSSIBLE` | 10      | At or above this, offer a community health promoter follow-up. |
| `EPDS_PROBABLE` | 13      | At or above this, offer a counsellor call.                     |
| Item 10 above 0 | always  | Urgent, same-day call, whatever the total.                     |

The clinical lead sets these values. They are environment settings so that they can change after
validation without a code change.

## Safety questions

After the EPDS, Dada asks two questions that are not part of the scale:

1. "Is someone at home hurting, threatening or forcing you?" (yes, no, prefer not to say). A "yes"
   makes the case high risk.
2. "Are you safe right now?" (yes, no). A "no" makes the case urgent.

These follow common practice in perinatal screening but are not a validated violence screening
tool. The safeguarding protocol decides what happens next (see [SAFEGUARDING.md](../SAFEGUARDING.md)).

## Changing wording

1. Open an issue with the "Wording or translation" template, or a pull request that changes
   `src/domain/epds.ts`, `src/domain/safety.ts` or `src/domain/messages.ts`.
2. The tests check that every screen still fits on USSD.
3. The clinical lead approves the change in the pull request before it is merged.
