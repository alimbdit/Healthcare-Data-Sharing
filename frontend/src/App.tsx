import { useEffect, useState } from "react";
import { getContractSigner, checkAndSwitchNetwork } from "./services/ethereum";
import {
  generateAesKey,
  encryptData,
  exportKey,
  decryptRecord,
} from "./utils/crypto";

interface MedicalRecord {
  ipfsHash: string;
  metadata: string;
  decryptedContent?: string;
}

export default function App() {
  const [account, setAccount] = useState<string>("");
  const [userRole, setUserRole] = useState<number>(0); // 0 = Unregistered, 1 = Patient, 2 = Doctor
  const [loading, setLoading] = useState<boolean>(false);

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);

  // Form States
  const [selectedRole, setSelectedRole] = useState<number>(1);
  const [doctorAddress, setDoctorAddress] = useState<string>("");
  const [targetPatientAddress, setTargetPatientAddress] = useState<string>("");
  const [medicalNote, setMedicalNote] = useState<string>("");

  // 1. Wallet Connection & Role Fetching
  const connectWallet = async () => {
    try {
      setLoading(true);
      await checkAndSwitchNetwork();
      const contract = await getContractSigner();
      const signerAddress = await (contract.runner as any)?.getAddress();

      if (signerAddress) {
        setAccount(signerAddress);
        const role = await contract.userRoles(signerAddress);
        setUserRole(Number(role));
      }
    } catch (err: any) {
      alert(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          connectWallet();
        } else {
          setAccount("");
          setUserRole(0);
        }
      });
    }
  }, []);

  // 2. Register User (Role 1 = Patient, Role 2 = Doctor)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const contract = await getContractSigner();
      const tx = await contract.registerUser(selectedRole);
      await tx.wait();

      alert("User registered successfully!");
      setUserRole(selectedRole);
    } catch (err: any) {
      alert(err.reason || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // 3. Grant Access to Doctor (Patient Only)
  const handleGrantAccess = async () => {
    if (!doctorAddress) return alert("Enter doctor's address");
    try {
      setLoading(true);
      const contract = await getContractSigner();
      const tx = await contract.grantAccess(doctorAddress);
      await tx.wait();
      alert(`Access granted to doctor: ${doctorAddress}`);
      setDoctorAddress("");
    } catch (err: any) {
      alert(err.reason || "Grant access failed");
    } finally {
      setLoading(false);
    }
  };

  // 4. Revoke Access from Doctor (Patient Only)
  const handleRevokeAccess = async () => {
    if (!doctorAddress) return alert("Enter doctor's address");
    try {
      setLoading(true);
      const contract = await getContractSigner();
      const tx = await contract.revokeAccess(doctorAddress);
      await tx.wait();
      alert(`Access revoked from doctor: ${doctorAddress}`);
      setDoctorAddress("");
    } catch (err: any) {
      alert(err.reason || "Revoke access failed");
    } finally {
      setLoading(false);
    }
  };

  // 5. Add Record for Patient (Doctor Only)
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPatientAddress || !medicalNote)
      return alert("Fill in all fields");

    try {
      setLoading(true);
      // Client-side AES-256-GCM Encryption
      const key = await generateAesKey();
      const { encryptedData, iv } = await encryptData(medicalNote, key);
      const exportedKey = await exportKey(key);

      // Simulated IPFS Hash & Payload with Encrypted CipherText Included
      const sampleIpfsHash =
        "Qm" + Math.random().toString(36).substring(2, 15) + "Record";
      const metadataPayload = JSON.stringify({
        key: exportedKey,
        iv,
        cipherText: encryptedData, // <--- Fixed: Added cipherText for decryption
        cipherTextLength: encryptedData.length,
      });

      const contract = await getContractSigner();
      const tx = await contract.addRecord(
        targetPatientAddress,
        sampleIpfsHash,
        metadataPayload,
      );
      await tx.wait();

      alert("Record encrypted and saved on Sepolia!");
      setMedicalNote("");
    } catch (err: any) {
      alert(err.reason || "Add record failed");
    } finally {
      setLoading(false);
    }
  };

  // 6. View & Auto-Decrypt Patient Records
  const handleViewRecords = async (targetAddr?: string) => {
    const fetchAddr = targetAddr || account;
    if (!fetchAddr) return alert("Patient address required");

    try {
      setLoadingRecords(true);
      const contract = await getContractSigner();
      const rawRecords = await contract.getPatientRecords.staticCall(fetchAddr);

      // Decrypt each record in parallel
      const decryptedList = await Promise.all(
        rawRecords.map(async (rec: any) => {
          const plainText = await decryptRecord(rec.ipfsHash, rec.metadata);
          return {
            ipfsHash: rec.ipfsHash,
            metadata: rec.metadata,
            decryptedContent: plainText,
          };
        }),
      );

      setRecords(decryptedList);
    } catch (err: any) {
      alert(err.reason || "Access denied or failed to fetch records");
    } finally {
      setLoadingRecords(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "2rem auto",
        fontFamily: "sans-serif",
        padding: "1rem",
      }}
    >
      <h2>🏥 Healthcare Data Sharing DApp</h2>

      {/* Wallet Connect */}
      <div
        style={{
          padding: "1rem",
          border: "1px solid #ddd",
          borderRadius: "8px",
          marginBottom: "1.5rem",
        }}
      >
        {!account ? (
          <button
            onClick={connectWallet}
            disabled={loading}
            style={{ padding: "0.5rem 1rem" }}
          >
            {loading ? "Connecting..." : "Connect MetaMask Wallet"}
          </button>
        ) : (
          <div>
            <p>
              🟢 <strong>Account:</strong> {account}
            </p>
            <p>
              👤 <strong>Current Role:</strong>{" "}
              {userRole === 1
                ? "Patient"
                : userRole === 2
                ? "Doctor"
                : "Unregistered"}
            </p>
          </div>
        )}
      </div>

      {account && (
        <>
          {/* Registration Form (If unregistered) */}
          {userRole === 0 && (
            <div
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                marginBottom: "1.5rem",
              }}
            >
              <h3>Register Role</h3>
              <form onSubmit={handleRegister}>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <option value={1}>Patient (Role 1)</option>
                  <option value={2}>Doctor (Role 2)</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: "0.5rem 1rem" }}
                >
                  {loading ? "Processing..." : "Register"}
                </button>
              </form>
            </div>
          )}

          {/* Patient Access Control Section */}
          {userRole === 1 && (
            <div
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                marginBottom: "1.5rem",
              }}
            >
              <h3>Manage Access (Patient Controls)</h3>
              <input
                type="text"
                placeholder="Doctor Ethereum Address (0x...)"
                value={doctorAddress}
                onChange={(e) => setDoctorAddress(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleGrantAccess}
                  disabled={loading}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Grant Access
                </button>
                <button
                  onClick={handleRevokeAccess}
                  disabled={loading}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#dc3545",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Revoke Access
                </button>
                <button
                  onClick={() => handleViewRecords(account)}
                  disabled={loadingRecords}
                  style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
                >
                  {loadingRecords ? "Decrypting..." : "View My Records"}
                </button>
              </div>
            </div>
          )}

          {/* Doctor Medical Record Management Section */}
          {userRole === 2 && (
            <div
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                marginBottom: "1.5rem",
              }}
            >
              <h3>Doctor Panel</h3>
              <form onSubmit={handleAddRecord}>
                <input
                  type="text"
                  placeholder="Patient Ethereum Address"
                  value={targetPatientAddress}
                  onChange={(e) => setTargetPatientAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                />
                <textarea
                  placeholder="Medical Diagnosis / Record Notes (AES-256-GCM Encrypted)..."
                  value={medicalNote}
                  onChange={(e) => setMedicalNote(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Add Record for Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewRecords(targetPatientAddress)}
                    disabled={loadingRecords}
                    style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
                  >
                    {loadingRecords ? "Decrypting..." : "View Patient Records"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Decrypted Records Display UI */}
          {records.length > 0 && (
            <div
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
            >
              <h3>📋 Patient Medical Records</h3>
              {records.map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "1rem",
                    background: "#f4fbf7",
                    border: "1px solid #28a745",
                    marginBottom: "0.75rem",
                    borderRadius: "6px",
                  }}
                >
                  <p style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem" }}>
                    🏥 <strong>Decrypted Diagnosis / Notes:</strong>{" "}
                    <span style={{ color: "#155724", fontWeight: "600" }}>
                      {rec.decryptedContent}
                    </span>
                  </p>
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary
                      style={{
                        cursor: "pointer",
                        color: "#6c757d",
                        fontSize: "0.85rem",
                      }}
                    >
                      View On-Chain Encrypted Payload
                    </summary>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                      <p style={{ margin: "2px 0" }}>
                        <strong>IPFS Reference:</strong>{" "}
                        <code>{rec.ipfsHash}</code>
                      </p>
                      <p style={{ margin: "2px 0", wordBreak: "break-all" }}>
                        <strong>Metadata JSON:</strong>{" "}
                        <code>{rec.metadata}</code>
                      </p>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
