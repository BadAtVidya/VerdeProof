# VerdeProof — Confidential Credentials

## Approved idea

VerdeProof implements the **Confidential Credentials** idea: prove that a credential is valid without disclosing the underlying evidence.

## Problem

Suppliers repeatedly send test reports, formulations, and audit documents to every buyer. Those documents expose sensitive manufacturing and supply-chain data, while buyers still need a trustworthy answer to a narrow question such as “does recycled content meet the required threshold?”

## Product

VerdeProof lets a trusted lab issue signed evidence to a supplier. The supplier then presents a zero-knowledge proof against a buyer-defined requirement. The chain records the requirement and the verification result, while the measured value, report hash, nonce, and lab signature remain private unless the supplier selectively discloses a field.

## Demo claim

For a requirement of `recycled content ≥ 50%`, a supplier with a private measurement can produce an on-chain `PASSED` result. The verifier learns the requirement, credential commitment, issuing lab, expiry/revocation status, and result — never the raw percentage by default.

## Contract capabilities

- Multiple trusted labs and auditors
- Signed lab evidence checked inside the circuit
- Expiration and revocation checks
- Buyer-configurable upper- or lower-bound thresholds
- Challenge-bound nullifiers to prevent replay
- Selective disclosure of measurement or report hash

## Scope decision

The preprod deployment keeps seven core circuits so the contract fits the current block-resource budget. Read-only views are obtained from the indexer; writes are wallet-signed and target the deployed contract address documented in the README.

## Privacy model

An observer can learn public requirements, credential metadata and commitments, lab registry metadata, verification outcomes, disclosed fields, and the deployed contract address. An observer cannot learn the private measured value, raw report hash, blinding nonce, lab signature, or role secret keys unless the supplier explicitly discloses permitted fields.
