export async function generateAesKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function encryptData(text: string, key: CryptoKey) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text),
  );

  return {
    encryptedData: Array.from(new Uint8Array(encryptedBuffer)),
    iv: Array.from(iv),
  };
}

export async function decryptRecord(
  ipfsHash: string,
  metadata: string,
): Promise<string> {
  try {
    if (!metadata) return "[No Metadata Found]";
    const parsed = JSON.parse(metadata);

    if (!parsed.key || !parsed.iv || !parsed.cipherText) {
      return "[Legacy / Unencrypted Format]";
    }

    // Convert base64 key back to CryptoKey
    const keyBuffer = Uint8Array.from(atob(parsed.key), (c) => c.charCodeAt(0));
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"],
    );

    const iv = new Uint8Array(parsed.iv);
    const cipherText = new Uint8Array(parsed.cipherText);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      cipherText,
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err: any) {
    console.warn(`Decryption skipped for hash ${ipfsHash}:`, err.message);
    return `[Encrypted Data Block - Hash: ${ipfsHash.substring(0, 12)}...]`;
  }
}
