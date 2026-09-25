"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract, submitCallTx } from "@midnight-ntwrk/midnight-js-contracts";
import * as VerdeProof from "../contracts/src/managed/verdeproof/contract/index.js";
import { witnesses } from "../contracts/src/witnesses";
import { CONTRACT_ADDRESS, PRIVATE_STATE_ID } from "./contract";
import type { ConnectedSession } from "./midnight";

const ZK_ASSET_PATH = "/zk/verdeproof/";

export type TransactionEvidence = {
  transactionId: string;
  transactionHash: string;
  blockHash: string;
  blockHeight: number;
};

export type DeploymentEvidence = TransactionEvidence & { contractAddress: string };

export function makeCompiledContract() {
  return CompiledContract.make("verdeproof", VerdeProof.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_ASSET_PATH),
  );
}

export async function deployVerdeProof(session: ConnectedSession): Promise<DeploymentEvidence> {
  if (session.config.networkId !== "preprod") {
    throw new Error(`Deployment blocked: expected preprod, got ${session.config.networkId}`);
  }

  const deployed = await (deployContract as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    args: [],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { callerSecret: crypto.getRandomValues(new Uint8Array(32)) },
  });
  const finalized = deployed.deployTxData.public;
  return {
    contractAddress: finalized.contractAddress,
    transactionId: finalized.txId,
    transactionHash: finalized.txHash,
    blockHash: finalized.blockHash,
    blockHeight: finalized.blockHeight,
  };
}

export async function publishRequirement(
  session: ConnectedSession,
  thresholdPercent: number,
): Promise<TransactionEvidence & { requirementId: string }> {
  const id = crypto.getRandomValues(new Uint8Array(32));
  const result = await (submitCallTx as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress: CONTRACT_ADDRESS,
    circuitId: "createRequirement",
    args: [id, VerdeProof.MetricType.RECYCLED_CONTENT, BigInt(thresholdPercent * 100), false, 0n, 0n],
    privateStateId: PRIVATE_STATE_ID,
  });
  return {
    requirementId: Array.from(id, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    transactionId: result.public.txId,
    transactionHash: result.public.txHash,
    blockHash: result.public.blockHash,
    blockHeight: result.public.blockHeight,
  };
}
