// VerdeProof demo simulator — shared types.
//
// These types mirror the on-chain records of contracts/src/verdeproof.compact
// one-to-one (Ledger, CredentialRecord, RequirementRecord, VerificationRecord)
// plus the private-state Evidence witness, so the demo UI exercises the same
// rules the circuits enforce. The "chain" bucket is what a real deployment
// would expose publicly; "wallets" is private state that never leaves a role's
// machine (on the real chain it lives only as a commitment).

export type MetricCode =
  | "RECYCLED_CONTENT"
  | "CARBON_INTENSITY"
  | "RESTRICTED_CHEMICAL"
  | "RENEWABLE_ENERGY"
  | "RESPONSIBLE_SOURCING"
  | "CERTIFICATION"
  | "ESG_SCORE";

export type MetricDef = {
  code: MetricCode;
  label: string;
  short: string;
  unit: string;
  /** percentage-like metrics are stored in basis points: 5,000 = 50% */
  basis: "percentage" | "value";
  max: number;
  /** default comparison direction when a buyer creates a requirement */
  lowerIsBetter: boolean;
  hint: string;
};

export const METRICS: Record<MetricCode, MetricDef> = {
  RECYCLED_CONTENT: {
    code: "RECYCLED_CONTENT",
    label: "Recycled content",
    short: "Recycled",
    unit: "%",
    basis: "percentage",
    max: 10_000,
    lowerIsBetter: false,
    hint: "Share of recycled material, in basis points (5,000 = 50%)",
  },
  CARBON_INTENSITY: {
    code: "CARBON_INTENSITY",
    label: "Carbon intensity",
    short: "Carbon",
    unit: "gCO₂e/kg",
    basis: "value",
    max: 100_000,
    lowerIsBetter: true,
    hint: "Cradle-to-gate emissions per kilogram of product",
  },
  RESTRICTED_CHEMICAL: {
    code: "RESTRICTED_CHEMICAL",
    label: "Restricted chemicals",
    short: "Chemicals",
    unit: "ppm",
    basis: "value",
    max: 100_000,
    lowerIsBetter: true,
    hint: "Concentration of restricted substances (0 = not detected)",
  },
  RENEWABLE_ENERGY: {
    code: "RENEWABLE_ENERGY",
    label: "Renewable energy",
    short: "Renewables",
    unit: "%",
    basis: "percentage",
    max: 10_000,
    lowerIsBetter: false,
    hint: "Share of renewable energy in production, in basis points",
  },
  RESPONSIBLE_SOURCING: {
    code: "RESPONSIBLE_SOURCING",
    label: "Responsible sourcing",
    short: "Sourcing",
    unit: "%",
    basis: "percentage",
    max: 10_000,
    lowerIsBetter: false,
    hint: "Audited responsibly-sourced input share, in basis points",
  },
  CERTIFICATION: {
    code: "CERTIFICATION",
    label: "Certification score",
    short: "Certification",
    unit: "/100",
    basis: "percentage",
    max: 10_000,
    lowerIsBetter: false,
    hint: "Scheme conformance score, in basis points",
  },
  ESG_SCORE: {
    code: "ESG_SCORE",
    label: "ESG score",
    short: "ESG",
    unit: "/100",
    basis: "percentage",
    max: 10_000,
    lowerIsBetter: false,
    hint: "Overall ESG assessment score, in basis points",
  },
};

export const METRIC_LIST = Object.values(METRICS);

export type CredentialStatus = "ACTIVE" | "REVOKED";
export type VerificationResult = "PASSED" | "DISCLOSED";
export type LabAction = "REGISTER" | "UPDATE" | "SET_ACTIVE" | "DELETE";

export type LabRecord = {
  labId: number;
  name: string;
  operatorKey: string;
  signingKey: string;
  active: boolean;
  revision: number;
};

export type CredentialRecord = {
  credentialId: string;
  commitment: string;
  supplierKey: string;
  productId: string;
  productName: string;
  metric: MetricCode;
  labId: number;
  issuedAt: number;
  validUntil: number;
  status: CredentialStatus;
  revision: number;
};

export type RequirementRecord = {
  requirementId: string;
  title: string;
  buyerKey: string;
  metric: MetricCode;
  threshold: number;
  isUpperBound: boolean;
  validFrom: number;
  /** 0 = open-ended */
  validUntil: number;
  active: boolean;
  revision: number;
  verificationCount: number;
};

export type VerificationRecord = {
  verificationId: string;
  /** null → disclosure-only presentation (regulator path) */
  requirementId: string | null;
  credentialId: string;
  supplierKey: string;
  metric: MetricCode;
  result: VerificationResult;
  evidenceCommitment: string;
  labId: number;
  disclosedValue: number | null;
  disclosedReportHash: string | null;
  nullifier: string;
  challenge: string;
  presentedAt: number;
};

/** The lab's signed test package — the private `Evidence` witness. */
export type Evidence = {
  credentialId: string;
  metric: MetricCode;
  actualValue: number;
  productId: string;
  inspectedAt: number;
  validUntil: number;
  reportHash: string;
  supplierKey: string;
  nonce: string;
  signature: string;
};

export type LedgerState = {
  chain: {
    labs: LabRecord[];
    requirements: RequirementRecord[];
    credentials: CredentialRecord[];
    verifications: VerificationRecord[];
    usedNullifiers: string[];
    paused: boolean;
    nextLabId: number;
  };
  /** supplier wallet private state — never published, only committed to */
  supplierWallet: {
    evidence: Record<string, Evidence>;
  };
};

export const SUPPLIER_KEY = "0xsup1…" as string;

export function formatMetricValue(metric: MetricCode, value: number): string {
  const def = METRICS[metric];
  if (def.basis === "percentage") {
    return `${(value / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  }
  return `${value.toLocaleString("en-US")} ${def.unit}`;
}

export function describeRequirement(req: {
  metric: MetricCode;
  threshold: number;
  isUpperBound: boolean;
}): string {
  const def = METRICS[req.metric];
  const op = req.isUpperBound ? "≤" : "≥";
  return `${def.label} ${op} ${formatMetricValue(req.metric, req.threshold)}`;
}
