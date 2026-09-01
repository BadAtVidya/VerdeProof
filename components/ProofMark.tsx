"use client";
import { motion } from "framer-motion";

export function ProofMark({ compact = false }: { compact?: boolean }) {
  return <div className={`proof-mark ${compact ? "compact" : ""}`} aria-label="Verified proof"><svg viewBox="0 0 120 120" role="img"><circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 5" /><circle cx="60" cy="60" r="39" fill="none" stroke="currentColor" strokeWidth="1" opacity=".35" /><motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: .3, duration: .8, ease: "easeOut" }} d="M36 60.5 52 76l33-35" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><path d="M60 11v7M60 102v7M11 60h7M102 60h7" stroke="currentColor" strokeWidth="2" /></svg><span>VERIFIED</span></div>;
}

export function RedactionReveal() {
  return <div className="redaction-visual"><div className="redaction-label">PRIVATE MEASUREMENT</div><div className="redacted-row"><span className="redacted-number">65%</span><span className="redaction-bar" /><span className="redaction-bar short" /></div><div className="reveal-arrow">proof circuit <span>→</span></div><div className="verified-row"><ProofMark compact /><div><strong>Requirement met</strong><small>Recycled content ≥ 50%</small></div></div><div className="visual-caption"><span className="pulse-dot" /> Raw value never shared</div></div>;
}
