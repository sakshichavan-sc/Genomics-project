import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.REGISTRY_ADMIN || deployer.address;
  const Registry = await ethers.getContractFactory("AnalysisPassportRegistry");
  const registry = await Registry.deploy(admin);
  await registry.waitForDeployment();
  console.log("AnalysisPassportRegistry deployed to:", await registry.getAddress());
  console.log("Admin / first registrar:", admin);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
