# VerdeProof

Privacy-preserving compliance proofs on Midnight. Suppliers prove a threshold such as `recycled content ≥ 50%` without exposing the measured value.

## Browser deployment

Contract deployment is intentionally browser-only. No funded server-side deployer and no local proof server are used.

Prerequisites:

- Node.js 22+
- Compact CLI on `PATH`
- 1AM browser extension installed and funded for Midnight preprod

Install, compile, and copy generated proving assets:

```bash
npm install
cd contracts
npm run compact
cd ..
mkdir -p public/zk/verdeproof
cp -Rf contracts/src/managed/verdeproof/keys public/zk/verdeproof/
cp -Rf contracts/src/managed/verdeproof/zkir public/zk/verdeproof/
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000/deploy](http://localhost:3000/deploy), select **preprod** in 1AM, and connect the extension. The page explicitly validates the returned network ID before creating any contract transaction.

The deploy flow follows the 1AM pattern:

1. Detect `window.midnight["1am"]`.
2. Connect with `wallet.connect("preprod")`.
3. Read wallet configuration and call `setNetworkId(config.networkId)` before provider or contract work.
4. Create a `FetchZkConfigProvider` from `/public/zk/verdeproof/`.
5. Get the proving provider from 1AM.
6. Build and submit `createUnprovenDeployTx` through the wallet-backed provider.
7. Display the deployed contract address in the browser.

The generated bundle reports Compact runtime `0.16.0`; app dependencies are pinned to the matching Midnight SDK family used by the reference deployment flow.

## Product routes

- `/` — product landing page
- `/verify` — live public verifier backed by the deployed contract
- `/deploy` — 1AM browser deployment to Midnight preprod
- `/app` — live buyer console: reads contract state and publishes requirements

## Current deployed contract

The frontend is pinned to this Midnight preprod contract:

`ee2bba3a7df6ffc726d29d8b020ee70efbec5aed1dbf46139c9ad744f8d446fa`

Connect 1AM on `/app` or `/verify` to read live indexer state. The console's **Publish requirement** action creates a real `createRequirement` transaction against this address. Private browser state is persisted locally so the same wallet can continue signing later actions.

## Checks

```bash
npm run lint
npm run build
```
