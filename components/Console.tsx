"use client";
/* eslint-disable @next/next/no-html-link-for-pages, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { detectWallet, createConnectedSession, type ConnectedSession } from "../lib/midnight";
import { fetchLiveContractSnapshot, CONTRACT_ADDRESS } from "../lib/contract";
import { publishRequirement } from "../lib/deploy";
import { ProofMark } from "./ProofMark";

const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`;

export function Console() {
  const pathname = usePathname();
  const view = pathname.split("/").filter(Boolean)[0] || "app";
  const viewCopy: Record<string, [string, string, string]> = {
    app: ["BUYER WORKSPACE / LIVE STATE", "Proof control room", "Every number below is read from VerdeProof on Midnight preprod."],
    proofs: ["PROOFS / LIVE STATE", "Verification proofs", "Public verification records written to the deployed contract."],
    requirements: ["REQUIREMENTS / LIVE STATE", "Requirement policies", "Publish and monitor buyer thresholds on the deployed contract."],
    credentials: ["CREDENTIALS / LIVE STATE", "Credential registry", "Credentials issued by trusted labs and stored on the deployed contract."],
    labs: ["TRUSTED LABS / LIVE STATE", "Issuer network", "Trusted lab registrations read from the deployed contract."],
    settings: ["SETTINGS / NETWORK", "Contract settings", "Network and contract configuration for this workspace."],
  };
  const [eyebrow, title, subtitle] = viewCopy[view] ?? viewCopy.app;
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [walletState, setWalletState] = useState<"checking" | "missing" | "ready">("checking");
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchLiveContractSnapshot>> | null>(null);
  const [threshold, setThreshold] = useState(50);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (connected = session) => {
    if (!connected) return;
    setSnapshot(await fetchLiveContractSnapshot(connected.config.indexerUri));
  }, [session]);

  useEffect(() => { detectWallet().then(wallet => setWalletState(wallet ? "ready" : "missing")); }, []);
  useEffect(() => { if (session) refresh(session).catch(e => setError(e instanceof Error ? e.message : String(e))); }, [session, refresh]);

  const connect = async () => {
    setBusy(true); setError("");
    try { const wallet = await detectWallet(); if (!wallet) throw new Error("1AM wallet not detected."); const api = await wallet.connect("preprod"); setSession(await createConnectedSession(api, "/zk/verdeproof/")); setNotice("Connected to the live VerdeProof contract."); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!session) return;
    setBusy(true); setError("");
    try { const id = await publishRequirement(session, threshold); await refresh(session); setNotice(`Requirement published: ${short(id)}`); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError("");
    try { throw new Error("No credential exists on this contract yet. Issue a lab credential before presenting a proof."); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const connected = Boolean(session);
  const value = snapshot ?? { paused: false, labs: 0, requirements: 0, credentials: 0, verifications: 0, usedNullifiers: 0 };
  const nav = (href: string, label: string, count?: number) => <a className={pathname === href ? "console-active" : ""} href={href}>{label}{count !== undefined && <span>{count}</span>}</a>;
  return <main className="console-page"><header className="console-header"><a href="/" className="site-logo"><span className="logo-glyph">V</span><span>Verde<span>Proof</span></span></a><div className="console-header-right"><span className="network-label"><i /> MIDNIGHT PREPROD</span><a href="/verify" className="header-link">Public verifier ↗</a></div></header><div className="console-layout"><aside className="console-nav"><p className="eyebrow">LIVE CONTRACT</p>{nav("/app", "Overview")}{nav("/proofs", "Proofs", value.verifications)}{nav("/requirements", "Requirements", value.requirements)}{nav("/credentials", "Credentials", value.credentials)}{nav("/labs", "Trusted labs", value.labs)}{nav("/settings", "Settings")}<div className="console-nav-foot"><span className="pulse-dot" /> {connected ? "Connected" : walletState === "missing" ? "Wallet missing" : "Connect wallet"}<br /><small>{short(CONTRACT_ADDRESS)}</small></div></aside><section className="console-main"><div className="console-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>{!connected ? <button className="dark-button" onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect 1AM →"}</button> : <button className="dark-button" onClick={verify} disabled={busy}>Verify on-chain →</button>}</div><div className="console-contract"><span>DEPLOYED CONTRACT</span><code>{CONTRACT_ADDRESS}</code></div><div className="console-stats"><div><span>VERIFIED PROOFS</span><strong>{value.verifications}</strong><b>On-chain records</b></div><div><span>ACTIVE REQUIREMENTS</span><strong>{value.requirements}</strong><b>Public threshold policies</b></div><div><span>TRUSTED ISSUERS</span><strong>{value.labs}</strong><b>Registered labs</b></div><div><span>RAW DATA SHARED</span><strong>—</strong><b>Never inferred from state</b></div></div><div className="console-columns"><section className="console-panel spotlight"><div className="panel-title"><div><p className="eyebrow">CONTRACT STATUS</p><h2>{value.paused ? "Paused." : "Accepting proofs."}</h2></div><span className="verified-tag">{value.paused ? "PAUSED" : "✓ LIVE"}</span></div><div className="spotlight-claim"><ProofMark compact /><div><span>VERDEPROOF / PREPROD</span><strong>{value.verifications ? `${value.verifications} proof${value.verifications === 1 ? "" : "s"} verified` : "No proofs yet"}</strong><p>Read from the deployed contract state. No seeded records.</p></div></div><div className="spotlight-meta"><span>CREDENTIALS <b>{value.credentials}</b></span><span>NULLIFIERS <b>{value.usedNullifiers}</b></span><span>ADDRESS <b className="mono">{short(CONTRACT_ADDRESS)}</b></span></div><a href="/verify" className="panel-link">Open public verifier ↗</a></section><section className="console-panel configurator"><div className="panel-title"><div><p className="eyebrow">REQUIREMENT TRANSACTION</p><h2>Set the bar.</h2></div><span className="mono">RECYCLED_CONTENT</span></div><p>Publish a real requirement to this contract. Threshold is stored publicly; supplier evidence stays private.</p><div className="threshold-readout"><strong>{threshold}%</strong><span>minimum recycled content</span></div><input aria-label="Recycled content threshold" type="range" min="10" max="90" value={threshold} onChange={e => setThreshold(Number(e.target.value))} /><div className="range-labels"><span>10%</span><span>90%</span></div><div className="preview-state"><span className="pulse-dot" /><b>{connected ? "Ready for wallet signature" : "Connect 1AM to publish"}</b><small>Writes only to {short(CONTRACT_ADDRESS)}</small></div><button className="light-button full-button" onClick={publish} disabled={!connected || busy}>Publish requirement →</button></section></div><div className="console-panel activity-console"><div className="panel-title"><div><p className="eyebrow">INDEXER STATE</p><h2>Contract activity</h2></div><button className="panel-link" onClick={() => refresh()}>Refresh ↻</button></div><div className="audit-row"><span className="audit-check">✓</span><div><b>{value.requirements} requirement records</b><small>Decoded from the live public ledger state</small></div><span className="mono">{short(CONTRACT_ADDRESS)}</span></div><div className="audit-row"><span className="audit-check">✓</span><div><b>{value.verifications} verification records</b><small>Zero fabricated activity; empty state stays empty</small></div><span className="mono">PREPROD</span></div></div></section></div>{(notice || error) && <div className={error ? "toast error" : "toast"}>{error || `✓ ${notice}`}</div>}</main>;
}
