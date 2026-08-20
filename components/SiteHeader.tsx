"use client";
import Link from "next/link";
import { useState } from "react";
import { CONTRACT_ADDRESS } from "../lib/contract";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><Link href="/" className="site-logo"><span className="logo-glyph">V</span><span>Verde<span>Proof</span></span></Link><nav className={`site-nav ${open ? "open" : ""}`}><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#industries">Industries</a><a href="#pricing">Pricing</a><a href="#developers">Developers</a></nav><div className="header-actions"><span className="header-contract mono" title={CONTRACT_ADDRESS}>PREPROD · {CONTRACT_ADDRESS.slice(0, 8)}…</span><Link href="/verify" className="header-link">Scan a proof <span>↗</span></Link><Link href="/deploy" className="header-link">Deploy <span>↗</span></Link><Link href="/app" className="header-cta">Open console <span>→</span></Link></div><button className="menu-toggle" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? "×" : "☰"}</button></header>;
}
