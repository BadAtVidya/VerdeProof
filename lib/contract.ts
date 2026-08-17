"use client";

import { ContractState } from "@midnight-ntwrk/compact-runtime";
import * as VerdeProof from "../contracts/src/managed/verdeproof/contract/index.js";
import { fromHex } from "./midnight";

export const CONTRACT_ADDRESS = "ee2bba3a7df6ffc726d29d8b020ee70efbec5aed1dbf46139c9ad744f8d446fa";
export const PRIVATE_STATE_ID = "verdeProofPrivateState";

export type LiveContractSnapshot = {
  paused: boolean;
  labs: number;
  requirements: number;
  credentials: number;
  verifications: number;
  usedNullifiers: number;
};

export type LiveVerification = {
  id: string;
  result: number;
  metric: number;
  valueDisclosed: boolean;
  reportDisclosed: boolean;
};

export async function fetchLiveContractSnapshot(indexerUri: string): Promise<LiveContractSnapshot> {
  const response = await fetch(indexerUri, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "query($address: HexEncoded!) { contractAction(address: $address) { state } }",
      variables: { address: CONTRACT_ADDRESS },
    }),
  });
  if (!response.ok) throw new Error(`Indexer HTTP error: ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((error: { message: string }) => error.message).join("; "));
  const stateHex = payload.data?.contractAction?.state;
  if (!stateHex) throw new Error("Contract state is not available yet on the preprod indexer.");

  const ledger = VerdeProof.ledger(ContractState.deserialize(fromHex(stateHex)).data);
  return {
    paused: ledger.paused,
    labs: Number(ledger.labs.size()),
    requirements: Number(ledger.requirements.size()),
    credentials: Number(ledger.credentials.size()),
    verifications: Number(ledger.verifications.size()),
    usedNullifiers: Number(ledger.usedNullifiers.size()),
  };
}

export async function fetchLiveVerifications(indexerUri: string): Promise<LiveVerification[]> {
  const response = await fetch(indexerUri, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "query($address: HexEncoded!) { contractAction(address: $address) { state } }", variables: { address: CONTRACT_ADDRESS } }) });
  const payload = await response.json();
  const stateHex = payload.data?.contractAction?.state;
  if (!stateHex) return [];
  const ledger = VerdeProof.ledger(ContractState.deserialize(fromHex(stateHex)).data);
  return Array.from(ledger.verifications as Iterable<[Uint8Array, { result: number; metric: number; valueDisclosed: boolean; reportDisclosed: boolean }]>, ([id, record]) => ({ id: Array.from(id, byte => byte.toString(16).padStart(2, "0")).join(""), result: record.result, metric: record.metric, valueDisclosed: record.valueDisclosed, reportDisclosed: record.reportDisclosed }));
}
