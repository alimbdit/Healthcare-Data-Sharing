import crypto from "crypto";

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
}

/**
 * Encrypt sensitive medical record data off-chain using AES-256-GCM
 */
export function encryptMedicalData(
  data: string,
  secretKey: string,
): EncryptedPayload {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(secretKey, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    cipherText: encrypted,
    iv: iv.toString("hex"),
  };
}

/**
 * Decrypt medical record data off-chain
 */
export function decryptMedicalData(
  payload: EncryptedPayload,
  secretKey: string,
): string {
  const key = crypto.scryptSync(secretKey, "salt", 32);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex"),
  );

  let decrypted = decipher.update(payload.cipherText, "hex", "utf8");
  return decrypted;
}
