// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HealthcareDataSharing
 * @dev Secure access control and off-chain IPFS medical record index management.
 */
contract HealthcareDataSharing {
    enum Role { None, Patient, Doctor, Hospital }

    struct Record {
        string ipfsHash;
        string metadata;
        uint256 timestamp;
        address uploadedBy;
    }

    // Mappings
    mapping(address => Role) public userRoles;
    mapping(address => Record[]) private patientRecords;
    // patient => doctor => hasAccess
    mapping(address => mapping(address => bool)) public accessPermissions;

    // Audit Log Events
    event UserRegistered(address indexed userAddress, Role role);
    event RecordAdded(address indexed patient, string ipfsHash, address indexed addedBy);
    event AccessGranted(address indexed patient, address indexed doctor);
    event AccessRevoked(address indexed patient, address indexed doctor);
    event RecordAccessed(address indexed patient, address indexed accessedBy, uint256 recordCount);

    // Modifiers
    modifier onlyPatient() {
        require(userRoles[msg.sender] == Role.Patient, "Caller is not a registered patient");
        _;
    }

    modifier onlyDoctorOrHospital() {
        Role senderRole = userRoles[msg.sender];
        require(senderRole == Role.Doctor || senderRole == Role.Hospital, "Caller is not authorized staff");
        _;
    }

    /**
     * @dev Register a user with a specific role
     */
    function registerUser(Role _role) external {
        require(_role != Role.None, "Invalid role");
        require(userRoles[msg.sender] == Role.None, "User already registered");
        
        userRoles[msg.sender] = _role;
        emit UserRegistered(msg.sender, _role);
    }

    /**
     * @dev Grant record access permission to a specific doctor
     */
    function grantAccess(address _doctor) external onlyPatient {
        require(userRoles[_doctor] == Role.Doctor, "Target address is not a registered doctor");
        accessPermissions[msg.sender][_doctor] = true;
        emit AccessGranted(msg.sender, _doctor);
    }

    /**
     * @dev Revoke record access permission from a doctor
     */
    function revokeAccess(address _doctor) external onlyPatient {
        accessPermissions[msg.sender][_doctor] = false;
        emit AccessRevoked(msg.sender, _doctor);
    }

    /**
     * @dev Add an IPFS hash medical record to a patient's profile
     */
    function addRecord(address _patient, string memory _ipfsHash, string memory _metadata) external {
        require(userRoles[_patient] == Role.Patient, "Target is not a registered patient");
        
        // Allowed if the patient adds it themselves, or an authorized doctor/hospital adds it
        bool isSelf = (msg.sender == _patient);
        bool isAuthorizedStaff = (userRoles[msg.sender] == Role.Doctor || userRoles[msg.sender] == Role.Hospital) && 
                                (accessPermissions[_patient][msg.sender] || userRoles[msg.sender] == Role.Hospital);

        require(isSelf || isAuthorizedStaff, "Not authorized to add records for this patient");

        patientRecords[_patient].push(Record({
            ipfsHash: _ipfsHash,
            metadata: _metadata,
            timestamp: block.timestamp,
            uploadedBy: msg.sender
        }));

        emit RecordAdded(_patient, _ipfsHash, msg.sender);
    }

    /**
     * @dev View patient records based on permission rules
     */
    function getPatientRecords(address _patient) external returns (Record[] memory) {
        bool isSelf = (msg.sender == _patient);
        bool hasAccess = accessPermissions[_patient][msg.sender];

        require(isSelf || hasAccess, "Access denied to patient records");

        emit RecordAccessed(_patient, msg.sender, patientRecords[_patient].length);
        return patientRecords[_patient];
    }
}