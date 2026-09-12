import { network } from "hardhat";

async function main() {
  const { ethers } = await network.getOrCreate();
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);

  console.log(`Wallet Address: ${signer.address}`);
  console.log(`Sepolia Balance: ${ethers.formatEther(balance)} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
