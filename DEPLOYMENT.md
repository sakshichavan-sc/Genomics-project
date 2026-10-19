# Deployment checklist

## Vercel

1. Push this folder to a Git repository you control.
2. Import that repository in Vercel.
3. Use the repository root as the project root, install command `npm install`, and build command `npm run build`.
4. Add these environment variables in Vercel Project Settings → Environment Variables if you want explicit configuration:
   - `VITE_REGISTRY_ADDRESS=0xc1576223D05dCCB7888446cC7682cE0A5592EC51`
   - `VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`
5. Deploy and open the deployed site. The dashboard should report **Live** only if the configured address has contract bytecode on Sepolia and the RPC can read `paused()` and `getPassport()`.
6. Test with a wallet connected to Sepolia. Creating a passport is local; registering it requires the connected wallet to hold the contract's registrar role and enough Sepolia ETH for gas.

## Before announcing the site

- Confirm the supplied contract address is deployed on Sepolia and matches `AnalysisPassportRegistry` ABI. This project cannot verify deployment from a network-isolated build environment.
- Run `npm install`, `npm run build`, `npm test`, and `npm run lint` in an internet-enabled environment.
- Exercise wallet connect, wrong-network switching, authorized registration, duplicate rejection, package export, and verification against a real registered record.
- Keep private keys out of the frontend. `VITE_*` variables are public build-time values; never put secrets in them.
