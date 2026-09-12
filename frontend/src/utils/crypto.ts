// src/utils/crypto.ts

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
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text),
  );

  const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
  const ivArray = Array.from(iv);

  return {
    encryptedData: encryptedArray,
    iv: ivArray,
  };
}

export async function decryptRecord(
  ipfsHash: string,
  metadataJson: string,
): Promise<string> {
  try {
    const metadata = JSON.parse(metadataJson);

    // ১. Key এবং IV রিড করা
    const keyBase64 = metadata.key;
    const ivArray = new Uint8Array(metadata.iv);

    // ২. Base64 Key-কে Uint8Array-তে রূপান্তর
    const keyBuffer = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));

    // ৩. Web Crypto API-তে AES-GCM Key ইমপোর্ট করা
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // ৪. Encrypted Data এক্সট্র্যাক্ট করা
    const cipherTextRaw = metadata.cipherText || ipfsHash;
    let cipherBuffer: Uint8Array;

    if (Array.isArray(cipherTextRaw)) {
      cipherBuffer = new Uint8Array(cipherTextRaw);
    } else {
      cipherBuffer = Uint8Array.from(atob(cipherTextRaw), (c) =>
        c.charCodeAt(0),
      );
    }

    // ৫. ডাটা ডিক্রিপ্ট করা
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivArray as BufferSource,
      },
      cryptoKey,
      cipherBuffer as BufferSource,
    );

    // ৬. ডিক্রিপ্ট করা ডাটা প্লেনটেক্সটে রিটার্ন
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    return "⚠️ Decryption Failed (Access Denied or Invalid Key)";
  }
}
