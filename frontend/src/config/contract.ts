export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

export const CONTRACT_ABI = [
  "function registerUser(uint8 _role) external",
  "function userRoles(address) view returns (uint8)",
  "function grantAccess(address _doctor) external",
  "function revokeAccess(address _doctor) external",
  "function accessPermissions(address, address) view returns (bool)",
  "function addRecord(address _patient, string _ipfsHash, string _metadata) external",
  "function getPatientRecords(address _patient) view returns (tuple(string ipfsHash, string metadata)[])",
];
