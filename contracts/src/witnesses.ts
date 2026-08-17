import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

import type {
  Ledger,
  MetricType,
  Schnorr_SchnorrSignature,
} from "./managed/verdeproof/contract/index.js";

/**
 * The lab's signed test package. Created by the issuing lab after a physical
 * test, handed to the supplier off-chain, and held in private state by
 * whoever presents it (lab at issuance, supplier at verification).
 */
export type Evidence = {
  metric: MetricType;
  actualValue: bigint;
  productId: Uint8Array;
  inspectedAt: bigint;
  validUntil: bigint;
  reportHash: Uint8Array;
  supplier: Uint8Array;
  commitmentNonce: Uint8Array;
  signature: Schnorr_SchnorrSignature;
};

export type VerdeProofPrivateState = {
  callerSecret: Uint8Array;
  pendingEvidence?: Evidence;
};

const TWO_248 =
  452312848583266388373324160190187140051835877600158453279131187530910662656n;

const MAX_UINT32 = 4_294_967_295n;
const MAX_METRIC = 6; // last MetricType variant (ESG_SCORE)

const require32Bytes = (value: Uint8Array, name: string): Uint8Array => {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new Error(`${name} must be exactly 32 bytes`);
  }
  return value;
};

const requireBigInt = (value: bigint, name: string, min: bigint, max: bigint): bigint => {
  if (typeof value !== "bigint" || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
};

export const witnesses = {
  callerSecret: ({
    privateState,
  }: WitnessContext<Ledger, VerdeProofPrivateState>): [
    VerdeProofPrivateState,
    Uint8Array,
  ] => [
    privateState,
    require32Bytes(privateState.callerSecret, "callerSecret"),
  ],

  pendingEvidence: ({
    privateState,
  }: WitnessContext<Ledger, VerdeProofPrivateState>): [
    VerdeProofPrivateState,
    Evidence,
  ] => {
    const evidence = privateState.pendingEvidence;
    if (!evidence) {
      throw new Error("pendingEvidence is required for issuance and presentation circuits");
    }
    if (!Number.isInteger(evidence.metric) || evidence.metric < 0 || evidence.metric > MAX_METRIC) {
      throw new Error(`metric must be a known MetricType (0..${MAX_METRIC})`);
    }
    requireBigInt(evidence.actualValue, "actualValue", 0n, MAX_UINT32);
    requireBigInt(evidence.inspectedAt, "inspectedAt", 0n, 2n ** 64n - 1n);
    requireBigInt(evidence.validUntil, "validUntil", 1n, 2n ** 64n - 1n);
    if (evidence.validUntil <= evidence.inspectedAt) {
      throw new Error("validUntil must be greater than inspectedAt");
    }
    require32Bytes(evidence.productId, "productId");
    require32Bytes(evidence.supplier, "supplier");
    require32Bytes(evidence.reportHash, "reportHash");
    require32Bytes(evidence.commitmentNonce, "commitmentNonce");
    return [privateState, evidence];
  },

  getSchnorrReduction: (
    { privateState }: WitnessContext<Ledger, VerdeProofPrivateState>,
    challengeHash: bigint,
  ): [VerdeProofPrivateState, [bigint, bigint]] => [
    privateState,
    [challengeHash / TWO_248, challengeHash % TWO_248],
  ],
};
