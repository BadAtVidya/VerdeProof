import type { Metadata } from "next";
import DeployClient from "./DeployClient";
export const metadata: Metadata = { title: "Deploy VerdeProof · Midnight preprod", description: "Deploy VerdeProof through the 1AM browser wallet." };
export default function DeployPage() { return <DeployClient />; }
