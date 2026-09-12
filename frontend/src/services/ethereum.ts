import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../config/contract";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export async function checkAndSwitchNetwork() {
  if (!window.ethereum) throw new Error("MetaMask is not installed!");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  const sepoliaChainId = BigInt(import.meta.env.VITE_SEPOLIA_CHAIN_ID);

  if (network.chainId !== sepoliaChainId) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: import.meta.env.VITE_SEPOLIA_HEX_CHAIN_ID }],
      });
    } catch {
      throw new Error(
        "Please switch your MetaMask network to Sepolia Testnet.",
      );
    }
  }
}

export async function getContractSigner() {
  await checkAndSwitchNetwork();
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}
