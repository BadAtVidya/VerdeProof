import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
const compactJsRoot = dirname(require.resolve("@midnight-ntwrk/compact-js/package.json"));
const compactRuntimeRoot = dirname(require.resolve("@midnight-ntwrk/compact-runtime/package.json"));

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false, child_process: false };
      config.resolve.alias = {
          ...config.resolve.alias,
          "isomorphic-ws": require.resolve("./lib/isomorphic-ws-fix.mjs"),
          "@midnight-ntwrk/compact-js": compactJsRoot,
          "@midnight-ntwrk/compact-runtime": compactRuntimeRoot,
          // `require.resolve` uses Node's export condition and otherwise selects
          // the fs-backed WASM loader, which cannot run in the browser.
          "@midnight-ntwrk/onchain-runtime-v3": require.resolve(
            "./node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js",
          ),
          "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_fs.js": require.resolve(
            "./node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js",
          ),
      };
    }
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};

export default nextConfig;
