# 🏥 Secure Healthcare Data Sharing DApp

An end-to-end decentralized application (DApp) built on Ethereum Sepolia Testnet that enables secure, permissioned, and encrypted healthcare record management between Patients and Doctors.

## 🚀 Features

- **Role-Based Access Control (RBAC):** On-chain registration and identity management for Patients and Doctors.
- **Client-Side Encryption:** Medical records are encrypted using browser-native **AES-256-GCM** (Web Crypto API) before touching the network.
- **Granular Permission Controls:** Patients retain full control over their data with on-chain `Grant Access` and `Revoke Access` functions.
- **Auto-Decryption UI:** Real-time decryption of authorized records directly within the React interface.
- **Immutable Audit Trail:** Permission records and encrypted payloads are securely persisted on Ethereum Sepolia.

---

## 🛠️ Tech Stack

- **Smart Contracts:** Solidity (`^0.8.20`)
- **Blockchain Network:** Ethereum Sepolia Testnet
- **Contract Address:** `0x96607D08B350753E54b2087FC33E72ADB4058FFA`
- **Frontend Framework:** React + Vite + TypeScript
- **Web3 Integration:** Ethers.js v6
- **Cryptography:** Web Crypto API (SubtleCrypto: AES-256-GCM)

---

## 🔐 Architecture & Data Flow

```text
[ Doctor Input ] ──► [ Web Crypto API (AES-256-GCM) ] ──► [ On-Chain Encrypted Payload ]
                                                                      │
[ Patient View ]  ◄── [ Real-time Auto Decryption ]   ◄───────────────┘
```
