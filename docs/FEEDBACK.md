# User Feedback — Level 5

## Collection

Feedback came through the linked Google Form during the Preprod validation period. The supplied export contains 72 responses, 72 unique wallet addresses, and an average rating of 4.39/5.

Raw names and email addresses are intentionally excluded from this repository. Wallet addresses are tracked separately in [`USERS.md`](../USERS.md) because they are the verification evidence requested by the challenge.

## Main themes

| Theme | Signal | Product implication |
|---|---|---|
| Simple, trustworthy flow | Most ratings were 4 or 5; users repeatedly praised clarity, speed, status, and selective sharing. | Preserve short labels and visible verification state. |
| Workflow and privacy clarity | Users asked who can see submitted details, what happens after submission, and how verification works. | Explain public/private data and next steps before wallet actions. |
| Confirmation and review | Users requested clearer submit confirmation, preview/review, and a success state. | Show an explicit transaction state and remind users what was shared. |
| Mobile polish | Multiple responses mentioned cramped phone spacing and bottom navigation. | Keep controls full-width and increase mobile spacing. |

## Level 6 Improvements

| Change | User Feedback That Triggered It | Status |
|---|---|---|
| Added plain-English privacy and workflow guidance to launch docs and README. | Users wanted clarity about sensitive data, visibility, and the verification journey. | Complete |
| Added explicit onboarding, first-transaction, and demo guidance. | Users asked what happens after submitting and how to follow the flow. | Complete |
| Added launch-user tracking with wallet-only records and a 20-user target. | Level 6 requires verified Preprod user onboarding. | Complete |
| Documented mobile spacing and confirmation improvements as the next UI QA target. | Users reported cramped small-screen controls and unclear completion feedback. | Documented; verify manually on device |

## Follow-up QA

- Test `/app` and `/verify` at 320px, 375px, and 768px widths.
- Confirm wallet rejection, missing-wallet, wrong-network, and indexer-delay messages.
- Capture a successful requirement transaction and record its transaction/address evidence.
