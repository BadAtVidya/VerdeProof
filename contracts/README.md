# VerdeProof — Contract

Privacy-preserving compliance proofs on Midnight, written in Compact (`language_version >= 0.23`).

Suppliers prove a product meets a sustainability / material requirement **without exposing the confidential measurement**. Trusted labs verify the real data and issue signed credentials; the chain only ever sees commitments, policy metadata and pass/fail results.

```
Buyer needs recycled content ≥ 50%      Supplier's actual = 65% (private)

On-chain verification record:
  Req: ≥ 50%  →  ✅ PASSED              (65% never leaves the supplier's wallet)
```

> This package contains the contract, its witnesses and local tests only.
> **No deployment, network or wallet is involved anywhere in this package.**

---

## Trust model

| Role | Identity | Powers |
|---|---|---|
| Platform admin | `deriveAdminKey(secret)` | Register/update/disable labs, pause, revoke, transfer admin |
| Lab / auditor (many) | `deriveLabOperatorKey(secret)` + Jubjub signing key | Issue credentials, revoke **its own** credentials |
| Supplier | `deriveSupplierKey(secret)` | Present compliance proofs & choose disclosures |
| Buyer | `deriveBuyerKey(secret)` | Create configurable requirements |
| Consumer / regulator | none needed | Read verification records (QR) |

**Multi-trust:** labs live in a `Map<Uint<16>, LabRecord>` — any *active* registered lab can issue. There is no single issuing key; a compromised or delisted lab stops being able to pass verification the moment it is deactivated.

## Lifecycle

1. **Admin** registers trusted labs → `manageLab(REGISTER, labId, operatorKey, signingKey, …)`.
2. **Buyer** publishes a requirement → `createRequirement(id, metric, threshold, isUpperBound, …)`
   *e.g. recycled-content ≥ 5,000 bps, or carbon ≤ 500 gCO2e/kg (`isUpperBound = true`).*
3. **Lab** physically tests the product, holds the `Evidence` (value, report hash, nonce, Schnorr signature) in private state and commits it on-chain → `issueCredential(credentialId, labId)`. The commitment hides the measured value; the signature over it is verified **in-circuit** against the lab's registered key. The signed evidence package is handed to the supplier off-chain.
4. **Supplier** proves compliance → `presentComplianceProof(requirementId, credentialId, verificationId, challenge, …)`. The circuit checks, all inside the proof:
   - requirement is active and inside its window,
   - credential is **not revoked** and **not expired** (block-time check — old certs auto-invalid),
   - issuing lab is still registered **and active**,
   - the presented evidence opens the on-chain commitment and carries a **valid lab signature** — forged/unauthorized certificates fail here,
   - the presenter is the supplier the credential was bound to,
   - **the private value satisfies the configurable threshold** (direction-aware, revealed to nobody),
   - the supplier-chosen disclosures (if any) match the evidence,
   - the challenge-bound **nullifier** is fresh (anti-replay).
   On success a public `VerificationRecord` is written → this is what a **QR code** points at.
5. **Selective disclosure (regulator path)** → `presentDisclosure(credentialId, verificationId, challenge, valueDisclosed, disclosedValue, reportDisclosed, disclosedReportHash)` proves validity and reveals exactly the fields the supplier chooses — no threshold involved.
6. **Revocation** → `revokeCredential(credentialId, byAdmin)` by the issuing lab or admin. Every later presentation fails.

## Privacy model

| Public (ledger) | Private (witness, never leaves the wallet) |
|---|---|
| Lab registry (keys, signing keys, status) | Role secret keys |
| Requirements — metric, threshold, direction, window | Supplier secret / derived identity preimage |
| Credential **commitment** + metadata (metric, product id, lab, issued/expiry, pseudonymous supplier key, status) | Measured value (`actualValue`) |
| Verification records (result, disclosures the supplier chose, nullifier) | Raw report hash + full test report |
| Nullifiers (burned) | Blinding nonce, lab signature |

Design choice: evidence commitments are **reusable** — one credential can satisfy many buyers/requirements (the core "replace repeat document-sharing" goal). Replay of a proof *artifact* is blocked by challenge-bound nullifiers instead of single-use evidence.

## Circuits

| Circuit | Caller | Purpose |
|---|---|---|
| `manageAdmin` | admin | Pause / transfer admin |
| `manageLab` | admin | Lab registry CRUD (multi-trust) |
| `createRequirement` | buyer | Configurable thresholds, direction-aware |
| `issueCredential` | lab | Commit evidence on-chain, verify own signature |
| `revokeCredential` | issuing lab / admin | Pull a credential |
| `presentComplianceProof` | supplier | **Core ZK proof:** threshold met, data hidden |
| `presentDisclosure` | supplier | Validity + supplier-chosen fields |
| indexer state decoding | anyone | Reads for QR verification & SDK pre-checks |
| `derive*Key`, `isKnownMetric`, `evidenceChallenge` | pure | SDK helpers (identities, validation, signature challenge) |

Metric units: percentage-like metrics use basis points (`5,000` = 50%), carbon uses gCO2e per functional unit, restricted chemicals use ppm (`0` = not detected), certification uses an off-chain scheme code.

## Build & test (local only)

```bash
cd contracts
npm install
npm run compact   # compact compile src/verdeproof.compact src/managed/verdeproof
npm run test      # compiles, then runs the vitest suite
```

- Requires the `compact` CLI on `PATH` (artifacts land in `~/.compact`).
- `src/managed/` is generated compiler output and git-ignored.
- Tests exercise witness privacy boundaries, identity derivation, the challenge reduction and source-level privacy guarantees (raw value/report hash absent from ledger declarations, in-circuit signature check, block-time expiry, nullifier burn, direction-aware thresholds).

## Production notes (known limits, by design for this scope)

- `Map`/`Set` ledger types grow unbounded on-chain — fine here; a mainnet version would move history to Merkle/accumulator commitments.
- Mutating circuits should be checked against the preprod block budget before any deployment (this package intentionally does none).
- Lab signing (Schnorr over Jubjub) happens off-chain in the SDK; `evidenceChallenge` + `schnorrChallenge` expose the exact challenge derivation so signer and circuit always agree.
- Time checks use `kernel.blockTimeLessThan` (chain time); credential `validUntil = 0` is rejected at issuance, so every credential expires by construction.
