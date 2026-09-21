# VerdeProof Usage Guide

VerdeProof is a Midnight Preprod demo. It lets a buyer publish a compliance threshold while a supplier keeps the measured value private during proof generation.

## Getting Started on Preprod

1. Install the 1AM browser wallet.
2. Select **Midnight preprod** in the wallet.
3. Fund the wallet with Preprod tDUST.
4. Open the [live VerdeProof app](https://verde-proof.vercel.app/).
5. Open **Console** and confirm the displayed contract address matches the README.

Never enter raw laboratory reports, private keys, seed phrases, or other secrets into public form fields or chat. VerdeProof is a demo; use test data on Preprod.

## Your First Transaction

1. Open `/app` and select **Connect 1AM**.
2. Approve the connection on Preprod.
3. Set a recycled-content threshold.
4. Review the threshold and click **Publish requirement**.
5. Approve the wallet transaction.
6. Wait for indexer propagation, then refresh.
7. Open `/verify` to inspect public verification state.

The threshold and verification metadata are public. The raw measurement, report contents, witness state, and secret material remain private by design. The current deployed contract may show zero credentials or proofs until those transactions are submitted.

## Roles

- Buyer publishes a requirement.
- Trusted lab issues signed evidence.
- Supplier presents a proof without revealing the raw measurement.
- Public verifier reads the on-chain result.

## Troubleshooting

- Wallet missing: install 1AM, select Preprod, and reload.
- Wrong network: change the wallet network to Preprod.
- No new record: wait for indexer propagation and refresh.
- Transaction rejected: check wallet funds and review the transaction details.
