import { useEffect, useState } from "react";
import { getContractSigner, checkAndSwitchNetwork } from "./services/ethereum";
import {
  generateAesKey,
  encryptData,
  exportKey,
  decryptRecord,
} from "./utils/crypto";

// Data Interfaces
interface MedicalRecord {
  ipfsHash: string;
  metadata: string;
  decryptedContent?: string;
}

interface AuditLogItem {
  eventType: string;
  patientOrUser: string;
  actor: string;
  details: string;
  blockNumber: number;
}

interface RegisteredUserItem {
  address: string;
  role: string;
}

export default function App() {
  const [account, setAccount] = useState<string>("");
  const [userRole, setUserRole] = useState<number>(0); // 0 = Unregistered, 1 = Patient, 2 = Doctor, 3 = Hospital
  const [loading, setLoading] = useState<boolean>(false);

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);

  // Tab Navigation State ('dapp' | 'audit' | 'admin')
  const [activeTab, setActiveTab] = useState<"dapp" | "audit" | "admin">(
    "dapp",
  );

  // On-Chain Audit & Admin States
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [registeredUsersList, setRegisteredUsersList] = useState<
    RegisteredUserItem[]
  >([]);
  const [fetchingAudit, setFetchingAudit] = useState<boolean>(false);

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

  // 2. Fetch On-Chain Audit Logs & Admin Metrics from Smart Contract Events
  const fetchAuditLogsAndMetrics = async () => {
    try {
      setFetchingAudit(true);
      const contract = await getContractSigner();

      // Query all contract events from genesis to latest block using Event Name strings
      const [
        regEvents,
        grantEvents,
        revokeEvents,
        recordEvents,
        accessedEvents,
      ] = await Promise.all([
        contract.queryFilter("UserRegistered", 0, "latest"),
        contract.queryFilter("AccessGranted", 0, "latest"),
        contract.queryFilter("AccessRevoked", 0, "latest"),
        contract.queryFilter("RecordAdded", 0, "latest"),
        contract.queryFilter("RecordAccessed", 0, "latest"),
      ]);

      const logs: AuditLogItem[] = [];
      const userRoleMap: { [key: string]: string } = {};

      regEvents.forEach((e: any) => {
        const roleName =
          ["None", "Patient", "Doctor", "Hospital"][Number(e.args[1])] ||
          "Unknown";
        userRoleMap[e.args[0]] = roleName;
        logs.push({
          eventType: "👤 User Registered",
          patientOrUser: e.args[0],
          actor: e.args[0],
          details: `Role assigned: ${roleName}`,
          blockNumber: e.blockNumber,
        });
      });

      grantEvents.forEach((e: any) => {
        logs.push({
          eventType: "🔑 Access Granted",
          patientOrUser: e.args[0],
          actor: e.args[1],
          details: `Granted access to Doctor: ${e.args[1]}`,
          blockNumber: e.blockNumber,
        });
      });

      revokeEvents.forEach((e: any) => {
        logs.push({
          eventType: "🚫 Access Revoked",
          patientOrUser: e.args[0],
          actor: e.args[1],
          details: `Revoked access from Doctor: ${e.args[1]}`,
          blockNumber: e.blockNumber,
        });
      });

      recordEvents.forEach((e: any) => {
        logs.push({
          eventType: "📁 Record Added",
          patientOrUser: e.args[0],
          actor: e.args[2],
          details: `Encrypted record stored. IPFS Hash: ${e.args[1]}`,
          blockNumber: e.blockNumber,
        });
      });

      accessedEvents.forEach((e: any) => {
        logs.push({
          eventType: "👁️ Record Accessed",
          patientOrUser: e.args[0],
          actor: e.args[1],
          details: `Accessed ${e.args[2]?.toString()} record(s)`,
          blockNumber: e.blockNumber,
        });
      });

      // Sort logs by newest block first
      logs.sort((a, b) => b.blockNumber - a.blockNumber);
      setAuditLogs(logs);

      const userArray = Object.keys(userRoleMap).map((addr) => ({
        address: addr,
        role: userRoleMap[addr],
      }));
      setRegisteredUsersList(userArray);
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setFetchingAudit(false);
    }
  };

  // 3. Register User (Role 1 = Patient, Role 2 = Doctor, Role 3 = Hospital)
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

  // 4. Grant Access to Doctor/Hospital (Patient Only)
  const handleGrantAccess = async () => {
    if (!doctorAddress) return alert("Enter doctor's address");
    try {
      setLoading(true);
      const contract = await getContractSigner();
      const tx = await contract.grantAccess(doctorAddress);
      await tx.wait();
      alert(`Access granted to: ${doctorAddress}`);
      setDoctorAddress("");
    } catch (err: any) {
      alert(err.reason || "Grant access failed");
    } finally {
      setLoading(false);
    }
  };

  // 5. Revoke Access from Doctor/Hospital (Patient Only)
  const handleRevokeAccess = async () => {
    if (!doctorAddress) return alert("Enter doctor's address");
    try {
      setLoading(true);
      const contract = await getContractSigner();
      const tx = await contract.revokeAccess(doctorAddress);
      await tx.wait();
      alert(`Access revoked from: ${doctorAddress}`);
      setDoctorAddress("");
    } catch (err: any) {
      alert(err.reason || "Revoke access failed");
    } finally {
      setLoading(false);
    }
  };

  // 6. Add Record for Patient (Doctor & Hospital Staff)
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

      // Simulated IPFS Hash & Encrypted Payload
      const sampleIpfsHash =
        "Qm" + Math.random().toString(36).substring(2, 15) + "Record";
      const metadataPayload = JSON.stringify({
        key: exportedKey,
        iv,
        cipherText: encryptedData,
        cipherTextLength: encryptedData.length,
      });

      const contract = await getContractSigner();
      const tx = await contract.addRecord(
        targetPatientAddress,
        sampleIpfsHash,
        metadataPayload,
        { gasLimit: 500000 }, // ম্যানুয়াল গ্যাস লিমিট
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

  // 7. View & Auto-Decrypt Patient Records
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
        maxWidth: "850px",
        margin: "2rem auto",
        fontFamily: "sans-serif",
        padding: "1rem",
      }}
    >
      <h2>🏥 Healthcare Data Sharing DApp</h2>

      {/* Wallet Connection Banner */}
      <div
        style={{
          padding: "1rem",
          border: "1px solid #ddd",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          backgroundColor: "#f8f9fa",
        }}
      >
        {!account ? (
          <button
            onClick={connectWallet}
            disabled={loading}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            {loading ? "Connecting..." : "Connect MetaMask Wallet"}
          </button>
        ) : (
          <div>
            <p style={{ margin: "4px 0" }}>
              🟢 <strong>Account:</strong> <code>{account}</code>
            </p>
            <p style={{ margin: "4px 0" }}>
              👤 <strong>Current Role:</strong>{" "}
              <strong>
                {userRole === 1
                  ? "Patient"
                  : userRole === 2
                  ? "Doctor"
                  : userRole === 3
                  ? "Hospital Staff"
                  : "Unregistered"}
              </strong>
            </p>
          </div>
        )}
      </div>

      {account && (
        <>
          {/* Main Navigation Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "1.5rem",
              borderBottom: "2px solid #ddd",
              paddingBottom: "0.5rem",
            }}
          >
            <button
              onClick={() => setActiveTab("dapp")}
              style={{
                padding: "0.5rem 1rem",
                fontWeight: activeTab === "dapp" ? "bold" : "normal",
                borderBottom:
                  activeTab === "dapp" ? "3px solid #007bff" : "none",
                cursor: "pointer",
              }}
            >
              💻 DApp Workspace
            </button>
            <button
              onClick={() => {
                setActiveTab("audit");
                fetchAuditLogsAndMetrics();
              }}
              style={{
                padding: "0.5rem 1rem",
                fontWeight: activeTab === "audit" ? "bold" : "normal",
                borderBottom:
                  activeTab === "audit" ? "3px solid #007bff" : "none",
                cursor: "pointer",
              }}
            >
              📜 On-Chain Audit Log
            </button>
            <button
              onClick={() => {
                setActiveTab("admin");
                fetchAuditLogsAndMetrics();
              }}
              style={{
                padding: "0.5rem 1rem",
                fontWeight: activeTab === "admin" ? "bold" : "normal",
                borderBottom:
                  activeTab === "admin" ? "3px solid #007bff" : "none",
                cursor: "pointer",
              }}
            >
              🛡️ Admin Dashboard
            </button>
          </div>

          {/* TAB 1: MAIN DAPP WORKSPACE */}
          {activeTab === "dapp" && (
            <div>
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
                  <h3>Register System Role</h3>
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
                      <option value={3}>Hospital Staff (Role 3)</option>
                    </select>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
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
                    placeholder="Doctor/Hospital Ethereum Address (0x...)"
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

              {/* Doctor & Hospital Panel */}
              {(userRole === 2 || userRole === 3) && (
                <div
                  style={{
                    padding: "1rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    marginBottom: "1.5rem",
                    backgroundColor: userRole === 3 ? "#f0f7ff" : "#ffffff",
                  }}
                >
                  <h3>
                    {userRole === 2 ? "🩺 Doctor Panel" : "🏥 Hospital Panel"}
                  </h3>
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
                        {loadingRecords
                          ? "Decrypting..."
                          : "View Patient Records"}
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
                      <p
                        style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem" }}
                      >
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
                        <div
                          style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}
                        >
                          <p style={{ margin: "2px 0" }}>
                            <strong>IPFS Reference:</strong>{" "}
                            <code>{rec.ipfsHash}</code>
                          </p>
                          <p
                            style={{ margin: "2px 0", wordBreak: "break-all" }}
                          >
                            <strong>Metadata JSON:</strong>{" "}
                            <code>{rec.metadata}</code>
                          </p>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AUDIT LOG TAB */}
          {activeTab === "audit" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h3 style={{ margin: 0 }}>📜 Real-Time On-Chain Audit Trail</h3>
                <button
                  onClick={fetchAuditLogsAndMetrics}
                  disabled={fetchingAudit}
                  style={{ padding: "0.4rem 0.8rem", cursor: "pointer" }}
                >
                  {fetchingAudit ? "Fetching..." : "🔄 Refresh Logs"}
                </button>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#e9ecef" }}>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      Block
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      Action
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      Patient / Address
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        <code>#{log.blockNumber}</code>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        <strong>{log.eventType}</strong>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        <code>{log.patientOrUser}</code>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ padding: "12px", textAlign: "center" }}
                      >
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: ADMIN DASHBOARD TAB */}
          {activeTab === "admin" && (
            <div>
              <h3>🛡️ Administrator System Dashboard</h3>

              <div
                style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: "1rem",
                    backgroundColor: "#e3f2fd",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#0d6efd" }}>
                    Total System Users
                  </h4>
                  <h2 style={{ margin: 0 }}>{registeredUsersList.length}</h2>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: "1rem",
                    backgroundColor: "#e8f5e9",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#198754" }}>
                    Total Audit Records
                  </h4>
                  <h2 style={{ margin: 0 }}>{auditLogs.length}</h2>
                </div>
              </div>

              <h4>Registered Wallet Directory</h4>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#e9ecef" }}>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      #
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      Wallet Address
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                      System Role
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registeredUsersList.map((usr, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        <code>{usr.address}</code>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                        <strong>{usr.role}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
