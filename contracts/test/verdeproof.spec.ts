import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  Contract,
  MetricType,
  pureCircuits,
} from "../src/managed/verdeproof/contract/index.js";
import {
  witnesses,
  type Evidence,
  type VerdeProofPrivateState,
} from "../src/witnesses.js";

const bytes = (seed: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);

const MAX_UINT32 = 4_294_967_295n;
const U64_MAX = 2n ** 64n - 1n;

// A well-formed lab evidence package: 65.00% recycled content (basis points),
// inspected "now", valid until some later block time.
const evidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  metric: MetricType.RECYCLED_CONTENT,
  actualValue: 6_500n,
  productId: bytes(10),
  inspectedAt: 0n,
  validUntil: 10n,
  reportHash: bytes(11),
  supplier: bytes(12),
  commitmentNonce: bytes(13),
  signature: { announcement: { x: 1n, y: 2n }, response: 3n },
  ...overrides,
});

const witnessContext = (privateState: VerdeProofPrivateState) =>
  ({ privateState } as Parameters<typeof witnesses.callerSecret>[0]);

describe("VerdeProof deployable surface", () => {
  it("exposes exactly the intended circuit set", () => {
    const contract = new Contract(witnesses);

    expect(Object.keys(contract.provableCircuits).sort()).toEqual([
      "createRequirement",
      "issueCredential",
      "manageAdmin",
      "manageLab",
      "presentComplianceProof",
      "presentDisclosure",
      "revokeCredential",
    ]);

    expect(Object.keys(pureCircuits).sort()).toEqual([
      "deriveAdminKey",
      "deriveBuyerKey",
      "deriveLabOperatorKey",
      "deriveSupplierKey",
      "evidenceChallenge",
      "isKnownMetric",
    ]);
  });
});

describe("VerdeProof identity derivation", () => {
  it("derives deterministic, domain-separated role identities", () => {
    const secret = bytes(7);

    const admin = pureCircuits.deriveAdminKey(secret);
    const supplier = pureCircuits.deriveSupplierKey(secret);
    const lab = pureCircuits.deriveLabOperatorKey(secret);
    const buyer = pureCircuits.deriveBuyerKey(secret);

    expect(pureCircuits.deriveAdminKey(secret)).toEqual(admin);
    expect(pureCircuits.deriveSupplierKey(secret)).toEqual(supplier);
    expect(admin).not.toEqual(supplier);
    expect(admin).not.toEqual(lab);
    expect(admin).not.toEqual(buyer);
    expect(supplier).not.toEqual(lab);
    expect(supplier).not.toEqual(buyer);
    expect(lab).not.toEqual(buyer);
  });

  it("secrets derive different identities across roles", () => {
    const admin = pureCircuits.deriveAdminKey(bytes(1));
    const other = pureCircuits.deriveAdminKey(bytes(2));
    expect(admin).not.toEqual(other);
  });
});

describe("VerdeProof witness privacy boundaries", () => {
  it("rejects malformed caller secrets before proof generation", () => {
    const state: VerdeProofPrivateState = { callerSecret: new Uint8Array(31) };

    expect(() => witnesses.callerSecret(witnessContext(state))).toThrow(
      "callerSecret must be exactly 32 bytes",
    );
  });

  it("rejects presentations without pending evidence", () => {
    const missing: VerdeProofPrivateState = { callerSecret: bytes(1) };
    expect(() =>
      witnesses.pendingEvidence(
        witnessContext(missing) as Parameters<typeof witnesses.pendingEvidence>[0],
      ),
    ).toThrow("pendingEvidence is required");
  });

  it("rejects out-of-range private evidence", () => {
    const base: VerdeProofPrivateState = { callerSecret: bytes(1), pendingEvidence: evidence() };

    expect(() =>
      witnesses.pendingEvidence(
        witnessContext({
          ...base,
          pendingEvidence: evidence({ metric: 7 as MetricType }),
        }),
      ),
    ).toThrow("metric must be a known MetricType");

    expect(() =>
      witnesses.pendingEvidence(
        witnessContext({
          ...base,
          pendingEvidence: evidence({ actualValue: MAX_UINT32 + 1n }),
        }),
      ),
    ).toThrow("actualValue must be between");

    expect(() =>
      witnesses.pendingEvidence(
        witnessContext({
          ...base,
          pendingEvidence: evidence({ validUntil: 0n }),
        }),
      ),
    ).toThrow("validUntil must be between");

    expect(() =>
      witnesses.pendingEvidence(
        witnessContext({
          ...base,
          pendingEvidence: evidence({ inspectedAt: 10n, validUntil: 10n }),
        }),
      ),
    ).toThrow("validUntil must be greater than inspectedAt");
  });

  it("rejects malformed evidence byte fields", () => {
    const base: VerdeProofPrivateState = { callerSecret: bytes(1), pendingEvidence: evidence() };

    expect(() =>
      witnesses.pendingEvidence(
        witnessContext({
          ...base,
          pendingEvidence: evidence({ commitmentNonce: new Uint8Array(31) }),
        }),
      ),
    ).toThrow("commitmentNonce must be exactly 32 bytes");

    expect(() =>
      witnesses.pendingEvidence(
        witnessContext({
          ...base,
          pendingEvidence: evidence({ supplier: new Uint8Array(33) }),
        }),
      ),
    ).toThrow("supplier must be exactly 32 bytes");
  });

  it("accepts evidence at the value and time boundaries", () => {
    for (const actualValue of [0n, MAX_UINT32]) {
      const privateState: VerdeProofPrivateState = {
        callerSecret: bytes(1),
        pendingEvidence: evidence({ actualValue, validUntil: U64_MAX }),
      };

      const [, loaded] = witnesses.pendingEvidence(
        witnessContext(privateState) as Parameters<typeof witnesses.pendingEvidence>[0],
      );
      expect(loaded.actualValue).toEqual(actualValue);
    }
  });

  it("splits Schnorr challenge into reversible high and low limbs", () => {
    const challenge = (1n << 250n) + 123_456n;
    const [, [high, low]] = witnesses.getSchnorrReduction(
      witnessContext({ callerSecret: bytes(1) }),
      challenge,
    );

    const limbBase = 1n << 248n;
    expect(high * limbBase + low).toBe(challenge);
    expect(low).toBeLessThan(limbBase);
  });
});

describe("VerdeProof privacy guarantees (source level)", () => {
  const contractPath = fileURLToPath(
    new URL("../src/verdeproof.compact", import.meta.url),
  );
  const source = readFileSync(contractPath, "utf8");

  const ledgerDeclarations = [...source.matchAll(/export ledger ([^;]+);/g)].map(
    ([, declaration]) => declaration,
  );

  it("keeps the measured value and report hash out of the public ledger", () => {
    const declarations = ledgerDeclarations.join("\n");
    expect(declarations).not.toContain("actualValue");
    expect(declarations).not.toContain("reportHash");
    expect(declarations).not.toContain("Evidence");
  });

  it("verifies lab signatures in-circuit against the registered key", () => {
    expect(source).toContain("Schnorr_schnorrVerify<4>");
  });

  it("enforces expiry against block time (old certs auto-invalid)", () => {
    expect(source).toContain("kernel.blockTimeLessThan");
  });

  it("burns challenge-bound nullifiers to stop replay", () => {
    expect(source).toContain("usedNullifiers.member(publicNullifier)");
  });

  it("supports buyer-configurable, direction-aware thresholds", () => {
    expect(source).toContain("isUpperBound");
    expect(source).toContain("evidence.actualValue <= requirement.threshold");
    expect(source).toContain("evidence.actualValue >= requirement.threshold");
  });

  it("supports revocation and the regulator disclosure path", () => {
    expect(source).toContain("CredentialStatus.REVOKED");
    expect(source).toContain("presentDisclosure");
    expect(source).toContain("VerificationResult.DISCLOSED");
  });

  it("supports multiple trusted labs (no single point of trust)", () => {
    expect(source).toContain("export ledger labs: Map<Uint<16>, LabRecord>;");
  });
});
