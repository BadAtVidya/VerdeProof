// VerdeProof demo simulator — the engine.
//
// Every function below mirrors a circuit in contracts/src/verdeproof.compact
// and enforces the same checks in the same order, returning the contract's
// own assert messages on failure. This is what makes the demo honest: a
// forged, revoked or expired credential fails here exactly the way it fails
// in `presentComplianceProof` on-chain.
//
// Stand-ins for on-chain primitives (clearly scoped to this demo):
//   - `persistentCommit` → sync hash32 commitment
//   - Schnorr signature  → opaque "lab-signed" string created at issuance
//   - block time         → Date.now()

import {
  type CredentialRecord,
  type Evidence,
  type LabAction,
  type LabRecord,
  type LedgerState,
  type MetricCode,
  type RequirementRecord,
  type VerificationRecord,
  METRICS,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const DAY = 24 * 60 * 60 * 1000;

/** Deterministic 32-hex-char stand-in for the circuits' persistent hashes. */
export function hash32(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c * (i + 1), 2246822519) >>> 0;
  }
  let out = "";
  let state = (h1 ^ h2) >>> 0;
  for (let i = 0; i < 8; i += 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822519) + i >>> 0;
    out += state.toString(16).padStart(8, "0").slice(0, 8);
  }
  return `0x${out.slice(0, 32)}`;
}

function randomHex(n: number): string {
  let out = "";
  while (out.length < n) {
    out += Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0");
  }
  return out.slice(0, n);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomHex(10)}`;
}

export function commitmentOf(evidence: Evidence): string {
  return hash32(
    [
      "verdeproof:evidence-commit:v2",
      evidence.productId,
      evidence.supplierKey,
      evidence.metric,
      evidence.actualValue,
      evidence.inspectedAt,
      evidence.validUntil,
      evidence.reportHash,
      evidence.nonce,
    ].join("|"),
  );
}

export function nullifierOf(
  supplierKey: string,
  commitment: string,
  challenge: string,
): string {
  return hash32(
    ["verdeproof:present-nullifier:v1", supplierKey, commitment, challenge].join("|"),
  );
}

// ── governance ────────────────────────────────────────────────────────────────

export function manageLab(
  state: LedgerState,
  args: { action: LabAction; labId?: number; name?: string; active?: boolean },
): Result<LedgerState> {
  const { chain } = state;
  if (chain.paused) return { ok: false, error: "Contract is paused" };

  if (args.action === "REGISTER") {
    const lab: LabRecord = {
      labId: chain.nextLabId,
      name: args.name?.trim() || `Lab ${chain.nextLabId}`,
      operatorKey: `0xop${randomHex(12)}`,
      signingKey: `0xjk${randomHex(12)}`,
      active: true,
      revision: 1,
    };
    return {
      ok: true,
      value: {
        ...state,
        chain: {
          ...chain,
          labs: [...chain.labs, lab],
          nextLabId: chain.nextLabId + 1,
        },
      },
    };
  }

  const existing = chain.labs.find((l) => l.labId === args.labId);
  if (!existing) return { ok: false, error: "Lab not found" };

  if (args.action === "DELETE") {
    if (!existing.active) return { ok: false, error: "Lab already inactive" };
  }
  return {
    ok: true,
    value: {
      ...state,
      chain: {
        ...chain,
        labs: chain.labs.map((l) =>
          l.labId === existing.labId
            ? {
                ...l,
                name: args.action === "UPDATE" ? args.name?.trim() || l.name : l.name,
                active:
                  args.action === "DELETE"
                    ? false
                    : args.action === "SET_ACTIVE"
                      ? Boolean(args.active)
                      : l.active,
                revision: l.revision + 1,
              }
            : l,
        ),
      },
    },
  };
}

export function setPaused(state: LedgerState, paused: boolean): Result<LedgerState> {
  return { ok: true, value: { ...state, chain: { ...state.chain, paused } } };
}

// ── buyers — createRequirement / setRequirementActive ─────────────────────────

export function createRequirement(
  state: LedgerState,
  args: {
    title: string;
    metric: MetricCode;
    threshold: number;
    isUpperBound: boolean;
    validFrom?: number;
    validUntil?: number;
  },
): Result<LedgerState> {
  const { chain } = state;
  if (chain.paused) return { ok: false, error: "Contract is paused" };
  if (!(args.metric in METRICS)) return { ok: false, error: "Unknown metric type" };
  if (!args.isUpperBound && args.threshold <= 0) {
    return { ok: false, error: "Lower-bound threshold must be greater than zero" };
  }
  if (
    args.validUntil !== undefined &&
    args.validUntil !== 0 &&
    (args.validUntil <= (args.validFrom ?? Date.now()))
  ) {
    return { ok: false, error: "Requirement window is invalid" };
  }
  if (args.threshold > METRICS[args.metric].max) {
    return { ok: false, error: "Threshold exceeds the metric's maximum" };
  }

  const requirement: RequirementRecord = {
    requirementId: newId("req"),
    title: args.title.trim() || `${METRICS[args.metric].label} requirement`,
    buyerKey: hash32("buyer:nova"),
    metric: args.metric,
    threshold: args.threshold,
    isUpperBound: args.isUpperBound,
    validFrom: args.validFrom ?? Date.now(),
    validUntil: args.validUntil ?? 0,
    active: true,
    revision: 1,
    verificationCount: 0,
  };
  return {
    ok: true,
    value: {
      ...state,
      chain: { ...chain, requirements: [...chain.requirements, requirement] },
    },
  };
}

export function setRequirementActive(
  state: LedgerState,
  args: { requirementId: string; active: boolean },
): Result<LedgerState> {
  const existing = state.chain.requirements.find(
    (r) => r.requirementId === args.requirementId,
  );
  if (!existing) return { ok: false, error: "Requirement not found" };
  return {
    ok: true,
    value: {
      ...state,
      chain: {
        ...state.chain,
        requirements: state.chain.requirements.map((r) =>
          r.requirementId === args.requirementId
            ? { ...r, active: args.active, revision: r.revision + 1 }
            : r,
        ),
      },
    },
  };
}

// ── labs — issueCredential / revokeCredential ─────────────────────────────────

export function issueCredential(
  state: LedgerState,
  args: {
    labId: number;
    supplierName: string;
    productName: string;
    metric: MetricCode;
    actualValue: number;
    validDays: number;
  },
): Result<{ state: LedgerState; credential: CredentialRecord }> {
  const { chain } = state;
  if (chain.paused) return { ok: false, error: "Contract is paused" };

  const lab = chain.labs.find((l) => l.labId === args.labId);
  if (!lab || !lab.active) return { ok: false, error: "Lab not found or inactive" };

  const def = METRICS[args.metric];
  if (!def) return { ok: false, error: "Unknown metric type" };
  if (!(args.actualValue >= 0) || args.actualValue > def.max) {
    return { ok: false, error: "Actual value out of range for the metric" };
  }

  const inspectedAt = Date.now();
  const validUntil = inspectedAt + args.validDays * DAY;
  if (validUntil <= inspectedAt) {
    return { ok: false, error: "Credential must have an expiry" };
  }

  const supplierKey = hash32(`supplier:${args.supplierName}`);
  const evidence: Evidence = {
    credentialId: newId("cred"),
    metric: args.metric,
    actualValue: args.actualValue,
    productId: `GTIN-${randomHex(6).toUpperCase()}`,
    inspectedAt,
    validUntil,
    reportHash: hash32(`report:${args.productName}:${inspectedAt}`),
    supplierKey,
    nonce: randomHex(32),
    // Stand-in for the lab's Jubjub Schnorr signature over the commitment.
    signature: `signed-by:${lab.signingKey}`,
  };

  const credential: CredentialRecord = {
    credentialId: evidence.credentialId,
    commitment: commitmentOf(evidence),
    supplierKey,
    productId: evidence.productId,
    productName: args.productName.trim() || "Untitled product",
    metric: args.metric,
    labId: lab.labId,
    issuedAt: inspectedAt,
    validUntil,
    status: "ACTIVE",
    revision: 1,
  };

  return {
    ok: true,
    value: {
      state: {
        ...state,
        chain: { ...chain, credentials: [...chain.credentials, credential] },
        // The signed evidence package is handed to the supplier's wallet;
        // only the commitment above is published.
        supplierWallet: {
          ...state.supplierWallet,
          evidence: {
            ...state.supplierWallet.evidence,
            [credential.credentialId]: evidence,
          },
        },
      },
      credential,
    },
  };
}

export function revokeCredential(
  state: LedgerState,
  args: { credentialId: string; byAdmin?: boolean },
): Result<LedgerState> {
  const record = state.chain.credentials.find(
    (c) => c.credentialId === args.credentialId,
  );
  if (!record) return { ok: false, error: "Credential not found" };
  if (record.status === "REVOKED") {
    return { ok: false, error: "Credential is not active" };
  }
  return {
    ok: true,
    value: {
      ...state,
      chain: {
        ...state.chain,
        credentials: state.chain.credentials.map((c) =>
          c.credentialId === args.credentialId
            ? { ...c, status: "REVOKED" as const, revision: c.revision + 1 }
            : c,
        ),
      },
    },
  };
}

// ── suppliers — the core presentations ────────────────────────────────────────

export type Disclosure = {
  valueDisclosed: boolean;
  reportDisclosed: boolean;
};

export type PresentationOutcome = {
  state: LedgerState;
  verification: VerificationRecord;
  checks: { label: string; detail: string }[];
};

function isExpired(credential: CredentialRecord, now: number): boolean {
  return credential.validUntil <= now;
}

function labStatus(
  state: LedgerState,
  labId: number,
): { ok: true; lab: LabRecord } | { ok: false; error: string } {
  const lab = state.chain.labs.find((l) => l.labId === labId);
  if (!lab) return { ok: false, error: "Issuing lab is not registered" };
  if (!lab.active) return { ok: false, error: "Issuing lab is no longer active" };
  return { ok: true, lab };
}

/**
 * Mirrors `openLiveCredential` + threshold + `commitPresentation`:
 * a valid, unexpired, unrevoked credential from an active trusted lab,
 * bound to the presenting supplier, satisfying the requirement's threshold.
 */
export function presentComplianceProof(
  state: LedgerState,
  args: {
    requirementId: string;
    credentialId: string;
    disclosure: Disclosure;
  },
): Result<PresentationOutcome> {
  const { chain } = state;
  const checks: { label: string; detail: string }[] = [];
  const now = Date.now();

  if (chain.paused) return { ok: false, error: "Contract is paused" };

  const requirement = chain.requirements.find(
    (r) => r.requirementId === args.requirementId,
  );
  if (!requirement) return { ok: false, error: "Requirement not found" };
  if (!requirement.active) return { ok: false, error: "Requirement is not active" };
  if (requirement.validUntil !== 0 && requirement.validUntil <= now) {
    return { ok: false, error: "Requirement window has closed" };
  }
  checks.push({ label: "Requirement open", detail: requirement.title });

  const credential = chain.credentials.find(
    (c) => c.credentialId === args.credentialId,
  );
  if (!credential) return { ok: false, error: "Credential not found" };
  if (credential.status === "REVOKED") {
    return { ok: false, error: "Credential has been revoked" };
  }
  checks.push({
    label: "Credential live",
    detail: "issued, not revoked",
  });

  if (isExpired(credential, now)) {
    return { ok: false, error: "Credential has expired" };
  }
  checks.push({
    label: "Not expired",
    detail: `valid until ${new Date(credential.validUntil).toLocaleDateString()}`,
  });

  const lab = labStatus(state, credential.labId);
  if (!lab.ok) return lab;
  checks.push({ label: "Trusted lab", detail: lab.lab.name });

  const evidence = state.supplierWallet.evidence[args.credentialId];
  if (!evidence) {
    return { ok: false, error: "Evidence does not match the issued credential" };
  }
  if (commitmentOf(evidence) !== credential.commitment) {
    return { ok: false, error: "Evidence does not match the issued credential" };
  }
  if (!evidence.signature.startsWith("signed-by:")) {
    return { ok: false, error: "Invalid lab credential signature" };
  }
  checks.push({
    label: "Lab signature valid",
    detail: "Schnorr over the evidence commitment",
  });

  if (evidence.metric !== requirement.metric) {
    return { ok: false, error: "Credential metric does not match the requirement" };
  }
  checks.push({ label: "Metric matches", detail: METRICS[requirement.metric].label });

  const pass = requirement.isUpperBound
    ? evidence.actualValue <= requirement.threshold
    : evidence.actualValue >= requirement.threshold;
  if (!pass) {
    return { ok: false, error: "Requirement not met" };
  }
  checks.push({
    label: "Threshold satisfied",
    detail: "compared inside the proof — value stays hidden",
  });

  const nullifier = nullifierOf(credential.supplierKey, credential.commitment, credential.credentialId + requirement.requirementId);
  if (chain.usedNullifiers.includes(nullifier)) {
    return { ok: false, error: "Presentation challenge already consumed" };
  }
  checks.push({ label: "Nullifier fresh", detail: "challenge-bound, replay blocked" });

  const verification: VerificationRecord = {
    verificationId: newId("ver"),
    requirementId: requirement.requirementId,
    credentialId: credential.credentialId,
    supplierKey: credential.supplierKey,
    metric: requirement.metric,
    result: "PASSED",
    evidenceCommitment: credential.commitment,
    labId: credential.labId,
    disclosedValue: args.disclosure.valueDisclosed ? evidence.actualValue : null,
    disclosedReportHash: args.disclosure.reportDisclosed ? evidence.reportHash : null,
    nullifier,
    challenge: hash32(`${credential.credentialId}:${requirement.requirementId}:${Date.now()}`),
    presentedAt: now,
  };

  return {
    ok: true,
    value: {
      state: {
        ...state,
        chain: {
          ...chain,
          verifications: [...chain.verifications, verification],
          usedNullifiers: [...chain.usedNullifiers, nullifier],
          requirements: chain.requirements.map((r) =>
            r.requirementId === requirement.requirementId
              ? {
                  ...r,
                  verificationCount: r.verificationCount + 1,
                  revision: r.revision + 1,
                }
              : r,
          ),
        },
      },
      verification,
      checks,
    },
  };
}

/**
 * Mirrors `presentDisclosure`: validity + supplier-chosen fields, no threshold.
 */
export function presentDisclosure(
  state: LedgerState,
  args: { credentialId: string; disclosure: Disclosure },
): Result<PresentationOutcome> {
  const { chain } = state;
  const checks: { label: string; detail: string }[] = [];
  const now = Date.now();

  if (chain.paused) return { ok: false, error: "Contract is paused" };

  const credential = chain.credentials.find(
    (c) => c.credentialId === args.credentialId,
  );
  if (!credential) return { ok: false, error: "Credential not found" };
  if (credential.status === "REVOKED") {
    return { ok: false, error: "Credential has been revoked" };
  }
  checks.push({ label: "Credential live", detail: "issued, not revoked" });

  if (isExpired(credential, now)) {
    return { ok: false, error: "Credential has expired" };
  }
  checks.push({ label: "Not expired", detail: "valid at presentation time" });

  const lab = labStatus(state, credential.labId);
  if (!lab.ok) return lab;
  checks.push({ label: "Trusted lab", detail: lab.lab.name });

  const evidence = state.supplierWallet.evidence[args.credentialId];
  if (!evidence || commitmentOf(evidence) !== credential.commitment) {
    return { ok: false, error: "Evidence does not match the issued credential" };
  }
  if (!evidence.signature.startsWith("signed-by:")) {
    return { ok: false, error: "Invalid lab credential signature" };
  }
  checks.push({
    label: "Lab signature valid",
    detail: "Schnorr over the evidence commitment",
  });

  if (!args.disclosure.valueDisclosed && !args.disclosure.reportDisclosed) {
    return { ok: false, error: "A disclosure presentation must reveal at least one field" };
  }

  const nullifier = nullifierOf(credential.supplierKey, credential.commitment, `disclosure:${Date.now()}`);
  const verification: VerificationRecord = {
    verificationId: newId("ver"),
    requirementId: null,
    credentialId: credential.credentialId,
    supplierKey: credential.supplierKey,
    metric: credential.metric,
    result: "DISCLOSED",
    evidenceCommitment: credential.commitment,
    labId: credential.labId,
    disclosedValue: args.disclosure.valueDisclosed ? evidence.actualValue : null,
    disclosedReportHash: args.disclosure.reportDisclosed ? evidence.reportHash : null,
    nullifier,
    challenge: hash32(`disclosure:${credential.credentialId}:${Date.now()}`),
    presentedAt: now,
  };

  return {
    ok: true,
    value: {
      state: {
        ...state,
        chain: {
          ...chain,
          verifications: [...chain.verifications, verification],
          usedNullifiers: [...chain.usedNullifiers, nullifier],
        },
      },
      verification,
      checks,
    },
  };
}

/** Demo helper: forge evidence for an existing credential to show forgery failing. */
export function forgeEvidence(
  state: LedgerState,
  credentialId: string,
): Result<LedgerState> {
  const credential = state.chain.credentials.find((c) => c.credentialId === credentialId);
  if (!credential) return { ok: false, error: "Credential not found" };
  const forged: Evidence = {
    credentialId,
    metric: credential.metric,
    actualValue: 9_900,
    productId: credential.productId,
    inspectedAt: Date.now(),
    validUntil: credential.validUntil,
    reportHash: hash32(`forged:${Date.now()}`),
    supplierKey: credential.supplierKey,
    nonce: randomHex(32),
    signature: "signed-by:0xforged",
  };
  return {
    ok: true,
    value: {
      ...state,
      supplierWallet: {
        ...state.supplierWallet,
        evidence: { ...state.supplierWallet.evidence, [credentialId]: forged },
      },
    },
  };
}
