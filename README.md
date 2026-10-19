# GenomeProof — Analysis Passport Registry

A browser-based application for creating analysis manifests, fingerprinting datasets and outputs with SHA-256, registering commitments on Ethereum Sepolia, and independently checking exported passport packages against the registry contract.

## Requirements

- Node.js 20.19+ or 22.12+
- MetaMask or another EIP-1193 wallet for on-chain registration
- Sepolia test ETH for registration transactions

## Run locally

```bash
npm install
npm run dev
```

Optional environment configuration (the provided registry address is the default):

```bash
cp .env.example .env
```

- `VITE_REGISTRY_ADDRESS`: AnalysisPassportRegistry address on Sepolia. Defaults to `0xc1576223D05dCCB7888446cC7682cE0A5592EC51`.
- `VITE_SEPOLIA_RPC_URL`: public Sepolia JSON-RPC endpoint. Defaults to `https://ethereum-sepolia-rpc.publicnode.com`.

The dashboard charts and activity feed use actual records saved in the current browser, not generated demo data. The passport list is a local convenience cache; the on-chain registry is authoritative for registration and verification. Data saved in one browser is not automatically shared with another browser.

## Build and test

```bash
npm run build
npm test
npm run lint
```

## Contract

The exact deployed ABI is in `src/lib/registry-abi.json`. Solidity source and Hardhat tests in `contracts/` describe a legacy registry, not this deployed version; do not redeploy them as a replacement. Never commit private keys or `.env` files. To deploy the contract yourself, configure `contracts/.env` from `contracts/.env.example` and run `npm install` in `contracts/`, then `npm run deploy:sepolia`.

## Trust boundary

A matching commitment proves that the declared manifest and supplied artifacts match the registered fingerprints. It does not prove that the analysis was scientifically valid or honestly performed.
