"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { sampleSigningKey } from "@midnight-ntwrk/compact-runtime";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from "@midnight-ntwrk/midnight-js-contracts";
import * as VerdeProof from "../contracts/src/managed/verdeproof/contract/index.js";
import { witnesses } from "../contracts/src/witnesses";
import type { ConnectedSession } from "./midnight";

const ZK_ASSET_PATH = "/zk/verdeproof/";
export function makeCompiledContract() { return CompiledContract.make("verdeproof", VerdeProof.Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(ZK_ASSET_PATH)); }
export async function deployVerdeProof(session: ConnectedSession): Promise<string> { if (session.config.networkId !== "preprod") throw new Error(`Deployment blocked: expected preprod, got ${session.config.networkId}`); const compiledContract = makeCompiledContract(); const deployTxData = await (createUnprovenDeployTx as any)({ zkConfigProvider: session.providers.zkConfigProvider, walletProvider: session.providers.walletProvider }, { compiledContract, args: [], privateStateId: "verdeProofPrivateState", initialPrivateState: { callerSecret: crypto.getRandomValues(new Uint8Array(32)) }, signingKey: sampleSigningKey() }); const contractAddress = deployTxData.public.contractAddress; await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx }); await session.providers.privateStateProvider.setContractAddress(contractAddress); await session.providers.privateStateProvider.set("verdeProofPrivateState", deployTxData.private.initialPrivateState); await session.providers.privateStateProvider.setSigningKey(contractAddress, deployTxData.private.signingKey); return contractAddress; }

export async function publishRequirement(session: ConnectedSession, thresholdPercent: number): Promise<string> {
  const id = crypto.getRandomValues(new Uint8Array(32));
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress: "ee2bba3a7df6ffc726d29d8b020ee70efbec5aed1dbf46139c9ad744f8d446fa",
    circuitId: "createRequirement",
    args: [id, VerdeProof.MetricType.RECYCLED_CONTENT, BigInt(thresholdPercent * 100), false, 0n, 0n],
    privateStateId: "verdeProofPrivateState",
  });
  return Array.from(id, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
