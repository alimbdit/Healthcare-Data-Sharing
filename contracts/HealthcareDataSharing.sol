// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthcareDataSharing {
    // Role 1 = Patient, Role 2 = Doctor, Role 3 = Hospital, Role 4 = Admin
    enum Role { None, Patient, Doctor, Hospital, Admin }

    struct Record {
        string ipfsHash;
        string metadata;
        address addedBy;
        uint256 timestamp;
    }

    address public contractOwner;
    mapping(address => Role) public userRoles;
    mapping(address => mapping(address => bool)) public accessPermissions;
    mapping(address => Record[]) private patientRecords;
    
    address[] public registeredUsers;

    // Audit Log Events
    event UserRegistered(address indexed user, Role role, uint256 timestamp);
    event AccessGranted(address indexed patient, address indexed accessor, uint256 timestamp);
    event AccessRevoked(address indexed patient, address indexed accessor, uint256 timestamp);
    event RecordAdded(address indexed patient, address indexed addedBy, uint256 timestamp);

    constructor() {
        contractOwner = msg.sender;
        userRoles[msg.sender] = Role.Admin;
        registeredUsers.push(msg.sender);
        emit UserRegistered(msg.sender, Role.Admin, block.timestamp);
    }

    function registerRole(Role _role) external {
        require(_role != Role.None, "Invalid role");
        if (userRoles[msg.sender] == Role.None) {
            registeredUsers.push(msg.sender);
        }
        userRoles[msg.sender] = _role;
        emit UserRegistered(msg.sender, _role, block.timestamp);
    }

    function grantAccess(address _accessor) external {
        require(userRoles[msg.sender] == Role.Patient, "Only patients can grant access");
        accessPermissions[msg.sender][_accessor] = true;
        emit AccessGranted(msg.sender, _accessor, block.timestamp);
    }

    function revokeAccess(address _accessor) external {
        require(userRoles[msg.sender] == Role.Patient, "Only patients can revoke access");
        accessPermissions[msg.sender][_accessor] = false;
        emit AccessRevoked(msg.sender, _accessor, block.timestamp);
    }

    function addRecord(address _patient, string calldata _ipfsHash, string calldata _metadata) external {
        bool isDoctorOrHospital = (userRoles[msg.sender] == Role.Doctor || userRoles[msg.sender] == Role.Hospital);
        require(
            msg.sender == _patient || (isDoctorOrHospital && accessPermissions[_patient][msg.sender]),
            "Not authorized to add records for this patient"
        );
        patientRecords[_patient].push(Record(_ipfsHash, _metadata, msg.sender, block.timestamp));
        emit RecordAdded(_patient, msg.sender, block.timestamp);
    }

    function getPatientRecords(address _patient) external view returns (Record[] memory) {
        bool isDoctorOrHospital = (userRoles[msg.sender] == Role.Doctor || userRoles[msg.sender] == Role.Hospital);
        require(
            msg.sender == _patient || 
            (isDoctorOrHospital && accessPermissions[_patient][msg.sender]) ||
            userRoles[msg.sender] == Role.Admin,
            "Access denied"
        );
        return patientRecords[_patient];
    }

    function getAllRegisteredUsers() external view returns (address[] memory) {
        return registeredUsers;
    }
}