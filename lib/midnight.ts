"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { MidnightProvider, PrivateStateProvider, WalletProvider } from "@midnight-ntwrk/midnight-js-types";

const WALLET_ID = "1am";
const NETWORK_ID = "preprod";
const PRIVATE_STATE_ID = "verdeProofPrivateState";

type PrivateState = { callerSecret: Uint8Array };

export type ConnectedSession = {
  api: ConnectedAPI;
  config: Awaited<ReturnType<ConnectedAPI["getConfiguration"]>>;
  providers: {
    privateStateProvider: PrivateStateProvider<string, PrivateState>;
    publicDataProvider: ReturnType<typeof indexerPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider<string>;
    proofProvider: { proveTx: (tx: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  unshieldedAddress: string;
};

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const fromHex = (hex: string) => {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) {
    throw new Error("Invalid hex string from wallet.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
};

export function detectWallet(): Promise<InitialAPI | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const wallet = window.midnight?.[WALLET_ID];
      if (wallet) return resolve(wallet);
      if (++attempts > 50) return resolve(null);
      window.setTimeout(check, 100);
    };
    check();
  });
}

export async function connectWallet(): Promise<ConnectedAPI> {
  const wallet = await detectWallet();
  if (!wallet) throw new Error("1AM wallet not detected. Install the browser extension and reload.");
  if (!wallet.apiVersion.startsWith("4.")) {
    throw new Error(`Unsupported 1AM connector API ${wallet.apiVersion}; version 4.x is required.`);
  }
  const api = await wallet.connect(NETWORK_ID);
  const status = await api.getConnectionStatus();
  if (status.status !== "connected" || status.networkId !== NETWORK_ID) {
    throw new Error("1AM did not connect to Midnight preprod. Select preprod in the wallet.");
  }
  return api;
}

export async function createConnectedSession(
  api: ConnectedAPI,
  zkAssetBasePath: string,
  privateStatePassword: string,
): Promise<ConnectedSession> {
  if (privateStatePassword.length < 16) {
    throw new Error("Private-state password must contain at least 16 characters.");
  }

  const [config, unshielded, shielded] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
    api.hintUsage(["balanceUnsealedTransaction", "submitTransaction", "getProvingProvider"]),
  ]);
  if (config.networkId !== NETWORK_ID) {
    throw new Error(`1AM returned unexpected network: ${config.networkId}. Select preprod in the wallet.`);
  }

  setNetworkId(config.networkId);
  const zkConfigProvider = new FetchZkConfigProvider<string>(
    new URL(zkAssetBasePath, window.location.origin).toString(),
    window.fetch.bind(window),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider);
  const proofProvider = {
    proveTx: async (tx: any) => {
      const { CostModel } = await import("@midnight-ntwrk/ledger-v8");
      return tx.prove(provingProvider, CostModel.initialCostModel());
    },
  };
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!balanced.tx) throw new Error("balanceUnsealedTransaction returned no signed transaction.");
      const { Transaction } = await import("@midnight-ntwrk/ledger-v8");
      return Transaction.deserialize("signature", "proof", "binding", fromHex(balanced.tx));
    },
  };
  const midnightProvider: MidnightProvider = {
    submitTx: async (tx) => {
      const identifiers = tx.identifiers();
      if (identifiers.length === 0) throw new Error("Signed transaction contains no ledger transaction ID.");
      await api.submitTransaction(toHex(tx.serialize()));
      return identifiers[0];
    },
  };
  const { levelPrivateStateProvider } = await import("@midnight-ntwrk/midnight-js-level-private-state-provider");
  const privateStateProvider = levelPrivateStateProvider<string, PrivateState>({
    accountId: unshielded.unshieldedAddress,
    privateStoragePasswordProvider: () => privateStatePassword,
  });

  privateStateProvider.setContractAddress(
    "e08ec0611dc2a4eefde094303cab14e9c18c4473d1f2c8269fa2b2bfa944f44a",
  );
  if (!(await privateStateProvider.get(PRIVATE_STATE_ID))) {
    await privateStateProvider.set(PRIVATE_STATE_ID, {
      callerSecret: crypto.getRandomValues(new Uint8Array(32)),
    });
  }

  return {
    api,
    config,
    providers: {
      privateStateProvider,
      publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshielded.unshieldedAddress,
  };
}

export async function pollForState(
  queryUrl: string,
  contractAddress: string,
  onProgress?: (attempt: number) => void,
  maxAttempts = 120,
  intervalMs = 2000,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(attempt + 1);
    const response = await fetch(queryUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "query($address: HexEncoded!) { contractAction(address: $address) { state } }",
        variables: { address: contractAddress },
      }),
    });
    const data = await response.json();
    const state = data?.data?.contractAction?.state;
    if (state) return state as string;
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  throw new Error(`State not found after ${(maxAttempts * intervalMs) / 1000}s`);
}
