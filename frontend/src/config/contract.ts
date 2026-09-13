export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

export const CONTRACT_ABI = [
  // ----------------- EVENTS -----------------
  "event UserRegistered(address indexed userAddress, uint8 role)",
  "event RecordAdded(address indexed patient, string ipfsHash, address indexed addedBy)",
  "event AccessGranted(address indexed patient, address indexed doctor)",
  "event AccessRevoked(address indexed patient, address indexed doctor)",
  "event RecordAccessed(address indexed patient, address indexed accessedBy, uint256 recordCount)",

  // ----------------- WRITE FUNCTIONS -----------------
  "function registerUser(uint8 _role) external",
  "function grantAccess(address _doctor) external",
  "function revokeAccess(address _doctor) external",
  "function addRecord(address _patient, string _ipfsHash, string _metadata) external",

  // ----------------- READ / VIEW FUNCTIONS -----------------
  "function userRoles(address) view returns (uint8)",
  "function accessPermissions(address, address) view returns (bool)",
  "function registeredUsers(uint256) view returns (address)",
  "function getTotalUsers() view returns (uint256)",
  "function getAllUsers() view returns (address[])",

  // ----------------- RECORD VIEW FUNCTION -----------------
  // Solidity-তে getPatientRecords ফাংশনটি event emit করে, তাই এটিতে 'view' নেই
  // এবং Record Struct-এ timestamp ও uploadedBy যোগ করা হয়েছে
  "function getPatientRecords(address _patient) returns (tuple(string ipfsHash, string metadata, uint256 timestamp, address uploadedBy)[])",
];
