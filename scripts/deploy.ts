import { network } from "hardhat";

async function main() {
  const { ethers } = await network.getOrCreate();

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const HealthcareFactory = await ethers.getContractFactory(
    "HealthcareDataSharing",
  );
  const healthcare = await HealthcareFactory.deploy();
  await healthcare.waitForDeployment();

  const deployedAddress = await healthcare.getAddress();
  console.log("HealthcareDataSharing deployed to:", deployedAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
