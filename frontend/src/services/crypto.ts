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

    // ৩. Web Crypto API-তে AES-GCM Key ইমপোর্ট করা (as BufferSource যুক্ত করা হয়েছে)
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

    // ৫. ডাটা ডিক্রিপ্ট করা (iv এবং cipherBuffer-এ as BufferSource যুক্ত করা হয়েছে)
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivArray as BufferSource,
      },
      cryptoKey,
      cipherBuffer as BufferSource,
    );

    // ৬. ডিক্রিপ্ট করা ডাটা টেক্সটে কনভার্ট করা
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    return "⚠️ Decryption Failed (Access Denied or Invalid Key)";
  }
}
