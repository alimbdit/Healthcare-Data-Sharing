import "dotenv/config";
import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerifyPlugin from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";

// ESM / CJS Interop Safe Extraction
const toolboxPlugin =
  (hardhatToolboxMochaEthersPlugin as any).default ??
  hardhatToolboxMochaEthersPlugin;
const ethersPlugin =
  (hardhatEthersPlugin as any).default ?? hardhatEthersPlugin;
const verifyPlugin =
  (hardhatVerifyPlugin as any).default ?? hardhatVerifyPlugin;

export default defineConfig({
  plugins: [toolboxPlugin, ethersPlugin, verifyPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },

  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },

    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY
        ? [process.env.SEPOLIA_PRIVATE_KEY]
        : [],
    },
  },

  // Verification config for the Hardhat Verify plugin
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },
});
