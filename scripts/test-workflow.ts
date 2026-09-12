import { network } from "hardhat";
import {
  encryptMedicalData,
  decryptMedicalData,
} from "../utils/ipfsService.js";

async function main() {
  const { ethers } = await network.getOrCreate();
  const [owner, patient, doctor, unauthorizedDoctor] =
    await ethers.getSigners();

  console.log("=== 1. Deploying Healthcare Data Sharing Contract ===");
  const HealthcareFactory = await ethers.getContractFactory(
    "HealthcareDataSharing",
  );
  const healthcare = await HealthcareFactory.deploy();
  await healthcare.waitForDeployment();
  const contractAddress = await healthcare.getAddress();
  console.log(`Contract Deployed at: ${contractAddress}\n`);

  console.log("=== 2. Registering Users ===");
  // Register Patient (Role = 1) and Doctor (Role = 2)
  await (await healthcare.connect(patient).registerUser(1)).wait();
  console.log(`Patient registered: ${patient.address}`);

  await (await healthcare.connect(doctor).registerUser(2)).wait();
  console.log(`Doctor registered: ${doctor.address}\n`);

  console.log("=== 3. Off-chain AES Encryption & IPFS Hash Simulation ===");
  const rawMedicalRecord = JSON.stringify({
    patientName: "John Doe",
    diagnosis: "Hypertension",
    prescription: "Amlodipine 5mg",
    bloodGroup: "O+",
  });

  const secretPassphrase = "msc-blockchain-super-secret-key";
  const encryptedPayload = encryptMedicalData(
    rawMedicalRecord,
    secretPassphrase,
  );

  // IPFS Content Identifier (CID) simulation
  const mockIpfsHash = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
  const metadata = JSON.stringify({
    iv: encryptedPayload.iv,
    type: "EHR-Report",
  });

  console.log("Raw Medical Record Encrypted Successfully.");
  console.log(
    `Encrypted Ciphertext: ${encryptedPayload.cipherText.substring(0, 32)}...`,
  );
  console.log(`Mock IPFS Hash: ${mockIpfsHash}\n`);

  console.log("=== 4. Granting Access to Doctor ===");
  await (await healthcare.connect(patient).grantAccess(doctor.address)).wait();
  console.log(`Patient granted access to Doctor (${doctor.address})\n`);

  console.log("=== 5. Doctor Uploads Record to Blockchain Index ===");
  const addTx = await healthcare
    .connect(doctor)
    .addRecord(patient.address, mockIpfsHash, metadata);
  await addTx.wait();
  console.log("Record IPFS index written to Blockchain!\n");

  console.log("=== 6. Fetching & Decrypting Record as Authorized Doctor ===");
  const records = await healthcare
    .connect(doctor)
    .getPatientRecords.staticCall(patient.address);
  console.log(`Records fetched for patient: ${records.length} item(s)`);

  const fetchedRecord = records[0];
  const fetchedMetadata = JSON.parse(fetchedRecord.metadata);

  // Reconstruction of encrypted payload for decryption
  const reconstructedPayload = {
    cipherText: encryptedPayload.cipherText,
    iv: fetchedMetadata.iv,
  };

  const decryptedRecord = decryptMedicalData(
    reconstructedPayload,
    secretPassphrase,
  );
  console.log(
    "Decrypted Payload Match Check:",
    decryptedRecord === rawMedicalRecord ? "PASSED ✅" : "FAILED ❌",
  );
  console.log("Decrypted Record Content:", decryptedRecord);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
