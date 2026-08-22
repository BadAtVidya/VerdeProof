export const proofExample = {
  product: "Recycled PET sheet",
  supplier: "Aster Packaging",
  requirement: "Recycled content ≥ 50%",
  actual: "65%",
  lab: "Verity Labs",
  issued: "12 Jun 2026",
  expires: "09 Dec 2026",
  credential: "cred_7f4c91d8a2",
  verification: "ver_20c6b19a3e",
};

export const industries = [
  ["01", "Packaging", "Prove recycled resin content without exposing formulation or vendor pricing.", "package"],
  ["02", "Textiles", "Make fiber origin and recycled blend claims portable across every tier.", "thread"],
  ["03", "Automotive", "Verify low-carbon materials and restricted substances at component level.", "bolt"],
  ["04", "Consumer brands", "Turn a private supplier test into a public, scan-ready claim.", "scan"],
  ["05", "Test labs", "Issue signed credentials once, then let every authorized buyer verify.", "flask"],
  ["06", "ESG auditors", "Request only the extra evidence needed for a defensible review.", "scale"],
] as const;

export const capabilities = [
  ["01", "Expiration + revocation", "Credentials age out automatically. Pulled certificates stop verifying everywhere."],
  ["02", "Multi-lab trust", "Use a network of independent issuers. One lab never becomes your single point of failure."],
  ["03", "Configurable thresholds", "Set the bar per category, supplier group, or buyer policy — then reuse it."],
  ["04", "Selective disclosure", "Ask for a report hash or measured value. The supplier decides what leaves their wallet."],
] as const;
