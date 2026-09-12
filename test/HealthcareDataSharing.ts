import { expect } from "chai";
import { network } from "hardhat";

describe("HealthcareDataSharing", function () {
  async function deployFixture() {
    // Hardhat v3-এ network connection থেকে ethers অবজেক্ট প্রাপ্তি
    const { ethers } = await network.getOrCreate();

    const [owner, patient, doctor, hospital, unauthorizedDoctor] =
      await ethers.getSigners();
    const HealthcareFactory = await ethers.getContractFactory(
      "HealthcareDataSharing",
    );
    const healthcare = await HealthcareFactory.deploy();

    return { healthcare, owner, patient, doctor, hospital, unauthorizedDoctor };
  }

  describe("User Registration", function () {
    it("Should allow registering users with valid roles", async function () {
      const { healthcare, patient, doctor } = await deployFixture();

      // Role 1 = Patient, Role 2 = Doctor
      await expect(healthcare.connect(patient).registerUser(1))
        .to.emit(healthcare, "UserRegistered")
        .withArgs(patient.address, 1);

      await healthcare.connect(doctor).registerUser(2);

      expect(await healthcare.userRoles(patient.address)).to.equal(1);
      expect(await healthcare.userRoles(doctor.address)).to.equal(2);
    });

    it("Should not allow re-registration", async function () {
      const { healthcare, patient } = await deployFixture();
      await healthcare.connect(patient).registerUser(1);

      await expect(
        healthcare.connect(patient).registerUser(1),
      ).to.be.revertedWith("User already registered");
    });
  });

  describe("Access Management & Record Indexing", function () {
    it("Should grant and revoke doctor access correctly", async function () {
      const { healthcare, patient, doctor } = await deployFixture();

      await healthcare.connect(patient).registerUser(1);
      await healthcare.connect(doctor).registerUser(2);

      // Grant Access
      await expect(healthcare.connect(patient).grantAccess(doctor.address))
        .to.emit(healthcare, "AccessGranted")
        .withArgs(patient.address, doctor.address);

      expect(
        await healthcare.accessPermissions(patient.address, doctor.address),
      ).to.be.true;

      // Revoke Access
      await expect(healthcare.connect(patient).revokeAccess(doctor.address))
        .to.emit(healthcare, "AccessRevoked")
        .withArgs(patient.address, doctor.address);

      expect(
        await healthcare.accessPermissions(patient.address, doctor.address),
      ).to.be.false;
    });

    it("Should permit record creation and retrieval for authorized entities", async function () {
      const { healthcare, patient, doctor } = await deployFixture();

      await healthcare.connect(patient).registerUser(1);
      await healthcare.connect(doctor).registerUser(2);
      await healthcare.connect(patient).grantAccess(doctor.address);

      const sampleIpfsHash = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      const sampleMetadata = "Encrypted Patient Blood Test Report";

      // Doctor adds record for Patient
      await expect(
        healthcare
          .connect(doctor)
          .addRecord(patient.address, sampleIpfsHash, sampleMetadata),
      )
        .to.emit(healthcare, "RecordAdded")
        .withArgs(patient.address, sampleIpfsHash, doctor.address);

      // Patient fetches records
      const records = await healthcare
        .connect(patient)
        .getPatientRecords.staticCall(patient.address);
      expect(records.length).to.equal(1);
      expect(records[0].ipfsHash).to.equal(sampleIpfsHash);
      expect(records[0].metadata).to.equal(sampleMetadata);
    });

    it("Should block unauthorized doctors from viewing records", async function () {
      const { healthcare, patient, doctor, unauthorizedDoctor } =
        await deployFixture();

      await healthcare.connect(patient).registerUser(1);
      await healthcare.connect(doctor).registerUser(2);
      await healthcare.connect(unauthorizedDoctor).registerUser(2);

      await healthcare.connect(patient).grantAccess(doctor.address);

      await expect(
        healthcare
          .connect(unauthorizedDoctor)
          .getPatientRecords.staticCall(patient.address),
      ).to.be.revertedWith("Access denied to patient records");
    });
  });
});
