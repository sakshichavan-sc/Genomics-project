# GenomeProof contracts

This Hardhat 2 project uses only the Hardhat Ethers and Chai Matchers plugins required by the current tests. It does not load the full `hardhat-toolbox`, avoiding unrelated Ignition, TypeChain, gas reporter, and coverage peer requirements.

## Install and test (npm)

From this directory, run:

```powershell
npm install --legacy-peer-deps
npm run compile
npm test
```

For Sepolia deployment, copy `.env.example` to `.env` and configure `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY`. Never commit `.env` or share the private key. The deployment script deploys a new registry; it does not attach to an existing contract.
