"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectWallet, createConnectedSession, detectWallet, type ConnectedSession } from "../../lib/midnight";
import { CONTRACT_ADDRESS } from "../../lib/contract";
import { deployVerdeProof, type DeploymentEvidence } from "../../lib/deploy";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const explorerTx = (hash: string) => `https://preprod.midnightexplorer.com/transactions/${hash}`;

export default function DeployClient() {
  const [walletState, setWalletState] = useState<"checking" | "missing" | "ready">("checking");
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [evidence, setEvidence] = useState<DeploymentEvidence | null>(null);
  const [privateStatePassword, setPrivateStatePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    setNetworkId("preprod");
    detectWallet().then((wallet) => mounted.current && setWalletState(wallet ? "ready" : "missing"));
    return () => { mounted.current = false; };
  }, []);

  const connect = useCallback(async () => {
    setError("");
    setBusy(true);
    setStatus("Opening 1AM wallet…");
    try {
      setNetworkId("preprod");
      const api = await connectWallet();
      const connected = await createConnectedSession(api, "/zk/verdeproof/", privateStatePassword);
      setSession(connected);
      setStatus("Connected to Midnight preprod");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [privateStatePassword]);

  const deploy = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError("");
    setStatus("Waiting for wallet signing and network finalization…");
    try {
      const deployed = await deployVerdeProof(session);
      setEvidence(deployed);
      setStatus("Finalized on Midnight preprod.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [session]);

  return <main className="deploy-page"><header className="deploy-header"><a href="/" className="site-logo"><span className="logo-glyph">V</span><span>Verde<span>Proof</span></span></a><span className="deploy-network"><i /> MIDNIGHT PREPROD</span></header><section className="deploy-shell"><div className="deploy-intro"><p className="eyebrow">BROWSER DEPLOYMENT</p><h1>Put your proof<br /><i>on the network.</i></h1><p>Deploy VerdeProof to Midnight preprod through 1AM. Wallet reviews, balances, signs, and submits genuine Midnight transaction.</p><div className="deploy-policy"><span>1AM CONNECTOR API</span><span>WALLET SIGNED</span><span>PREPROD LOCKED</span><span>ENCRYPTED PRIVATE STATE</span></div></div><section className="deploy-card"><div className="deploy-card-head"><div><p className="eyebrow">VERDEPROOF CONTRACT</p><h2>Deploy to preprod</h2></div><span className="preprod-badge">PREPROD</span></div><div className="deploy-steps"><div className={session ? "done" : "active"}><b>01</b><span>Connect wallet</span><small>{session ? "Connected" : "Required"}</small></div><div className={evidence ? "done" : session ? "active" : "locked"}><b>02</b><span>Deploy contract</span><small>{evidence ? "Finalized" : "Wallet signing"}</small></div><div className={evidence ? "done" : "locked"}><b>03</b><span>Verify evidence</span><small>{evidence ? "Available" : "After deploy"}</small></div></div>{walletState === "missing" && <div className="deploy-warning"><strong>1AM browser extension required</strong><span>Install 1AM, select Midnight preprod, then reload this page.</span><a href="https://1am.xyz" target="_blank" rel="noreferrer">Get 1AM ↗</a></div>}{session && <div className="wallet-summary"><span className="pulse-dot"/><div><b>Wallet connected</b><small>{session.unshieldedAddress.slice(0, 18)}… · {session.config.networkId}</small></div></div>}{!session && walletState !== "missing" && <div className="wallet-connect"><input type="password" minLength={16} autoComplete="current-password" placeholder="Private-state password (16+ chars)" value={privateStatePassword} onChange={event => setPrivateStatePassword(event.target.value)} aria-label="Private-state encryption password"/><small>Encrypts Midnight private state on this device. Keep it safe; no recovery exists.</small><button className="deploy-primary" disabled={busy || privateStatePassword.length < 16} onClick={connect}>{busy ? status : "Connect 1AM wallet →"}</button></div>}{session && !evidence && <button className="deploy-primary" disabled={busy} onClick={deploy}>{busy ? status : "Deploy VerdeProof →"}</button>}{evidence && <div className="address-result"><div><span className="success-check">✓</span><div><strong>Contract finalized</strong><small>Block {evidence.blockHeight} · wallet-signed transaction</small></div></div><code>{evidence.contractAddress}</code><code>Tx ID: {evidence.transactionId}</code><a href={explorerTx(evidence.transactionHash)} target="_blank" rel="noreferrer">Verify transaction ↗</a><button onClick={() => navigator.clipboard?.writeText(evidence.contractAddress)}>Copy address</button></div>}{status && !evidence && <p className="deploy-status"><span className="pulse-dot"/> {status}</p>}{error && <div className="deploy-error" role="alert">{error}</div>}<p className="deploy-foot">Current deployment <code>{CONTRACT_ADDRESS}</code> · <a href="https://preprod.midnightexplorer.com/transactions/6692a2dcc8ac700a2d961e667dcb3a6bf67a3fe4acba4b2845c247be696344bc" target="_blank" rel="noreferrer">verify deployment ↗</a> · proving assets <code>/public/zk/verdeproof</code></p></section></section></main>;
}
