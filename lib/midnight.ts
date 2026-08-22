"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import type { MidnightProvider, WalletProvider } from "@midnight-ntwrk/midnight-js-types";

export type ConnectedSession = { api: any; config: any; providers: { privateStateProvider: ReturnType<typeof createPrivateStateProvider>; publicDataProvider: ReturnType<typeof createPublicDataProvider>; zkConfigProvider: FetchZkConfigProvider<any>; proofProvider: { proveTx: (tx: any) => Promise<any> }; walletProvider: WalletProvider; midnightProvider: MidnightProvider }; unshieldedAddress: string };
export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex: string) => { const normalized = hex.startsWith("0x") ? hex.slice(2) : hex; if (normalized.length % 2) throw new Error("Invalid hex string from wallet."); const bytes = new Uint8Array(normalized.length / 2); for (let i = 0; i < normalized.length; i += 2) bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16); return bytes; };
export function detectWallet(): Promise<any | null> { return new Promise((resolve) => { let attempts = 0; const check = () => { const wallet = (window as any).midnight?.["1am"]; if (wallet) return resolve(wallet); if (++attempts > 50) return resolve(null); setTimeout(check, 100); }; check(); }); }
function createPrivateStateProvider() {
  let scope = "";
  const states = new Map<string, unknown>();
  const keys = new Map<string, unknown>();
  const key = (id: string) => `${scope}:${id}`;
  const storageKey = (id: string) => `verdeproof:${scope}:${id}`;
  const encode = (value: unknown) => JSON.stringify(value, (_, item) => item instanceof Uint8Array ? { __bytes: Array.from(item) } : typeof item === "bigint" ? { __bigint: item.toString() } : item);
  const decode = (value: string) => JSON.parse(value, (_, item) => item?.__bytes ? new Uint8Array(item.__bytes) : item?.__bigint ? BigInt(item.__bigint) : item);
  return {
    setContractAddress(address: string) { scope = address; },
    async set(id: string, value: unknown) { states.set(key(id), value); if (typeof window !== "undefined") window.localStorage.setItem(storageKey(id), encode(value)); },
    async get(id: string) { if (states.has(key(id))) return states.get(key(id)); const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey(id)) : null; const value = stored ? decode(stored) : null; if (value) states.set(key(id), value); return value; },
    async remove(id: string) { states.delete(key(id)); if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(id)); },
    async clear() { states.clear(); },
    async setSigningKey(address: string, value: unknown) { keys.set(address, value); },
    async getSigningKey(address: string) { return keys.get(address) ?? null; },
    async removeSigningKey(address: string) { keys.delete(address); },
    async clearSigningKeys() { keys.clear(); },
    async exportPrivateStates(): Promise<never> { throw new Error("Not implemented."); },
    async importPrivateStates(): Promise<never> { throw new Error("Not implemented."); },
    async exportSigningKeys(): Promise<never> { throw new Error("Not implemented."); },
    async importSigningKeys(): Promise<never> { throw new Error("Not implemented."); }
  };
}
function createPublicDataProvider(queryUrl: string, subscriptionUrl: string) { return indexerPublicDataProvider(queryUrl, subscriptionUrl); }
export async function createConnectedSession(api: any, zkAssetBasePath: string): Promise<ConnectedSession> { const [config, unshielded, shielded] = await Promise.all([api.getConfiguration(), api.getUnshieldedAddress(), api.getShieldedAddresses()]); if (config.networkId !== "preprod") throw new Error(`1AM returned unexpected network: ${config.networkId}. Select preprod in the wallet.`); setNetworkId(config.networkId); const zkConfigProvider = new FetchZkConfigProvider(new URL(zkAssetBasePath, window.location.origin).toString(), window.fetch.bind(window)); const provingProvider = await api.getProvingProvider(zkConfigProvider); const proofProvider = { proveTx: async (tx: any) => { const { CostModel } = await import("@midnight-ntwrk/ledger-v8"); return tx.prove(provingProvider, CostModel.initialCostModel()); } }; const walletProvider: WalletProvider = { getCoinPublicKey: () => shielded.shieldedCoinPublicKey, getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey, balanceTx: async (tx: any) => { const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize())); if (!balanced?.tx) throw new Error("balanceUnsealedTransaction returned invalid result"); const { Transaction } = await import("@midnight-ntwrk/ledger-v8"); return Transaction.deserialize("signature", "proof", "binding", fromHex(balanced.tx)); } }; const midnightProvider: MidnightProvider = { submitTx: async (tx: any) => { const result = await api.submitTransaction(toHex(tx.serialize())); if (typeof result === "string" && result) return result; if (result?.transactionId) return result.transactionId; if (result?.id) return result.id; return toHex(tx.serialize()).slice(0, 64); } }; const privateStateProvider = createPrivateStateProvider(); privateStateProvider.setContractAddress("ee2bba3a7df6ffc726d29d8b020ee70efbec5aed1dbf46139c9ad744f8d446fa"); if (!(await privateStateProvider.get("verdeProofPrivateState"))) await privateStateProvider.set("verdeProofPrivateState", { callerSecret: crypto.getRandomValues(new Uint8Array(32)) }); return { api, config, providers: { privateStateProvider, publicDataProvider: createPublicDataProvider(config.indexerUri, config.indexerWsUri), zkConfigProvider, proofProvider, walletProvider, midnightProvider }, unshieldedAddress: unshielded.unshieldedAddress }; }
export async function pollForState(queryUrl: string, contractAddress: string, onProgress?: (attempt: number) => void, maxAttempts = 120, intervalMs = 2000) { for (let i = 0; i < maxAttempts; i++) { onProgress?.(i + 1); const response = await fetch(queryUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: `query($address: HexEncoded!) { contractAction(address: $address) { state } }`, variables: { address: contractAddress } }) }); const data = await response.json(); const state = data?.data?.contractAction?.state; if (state) return state as string; await new Promise((resolve) => setTimeout(resolve, intervalMs)); } throw new Error(`State not found after ${maxAttempts * intervalMs / 1000}s`); }
