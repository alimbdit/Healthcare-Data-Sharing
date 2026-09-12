export async function uploadToIPFS(
  encryptedData: object,
  pinataJwt: string,
): Promise<string> {
  const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: encryptedData,
      pinataMetadata: { name: `Medical_Record_${Date.now()}.json` },
    }),
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed with status ${response.status}`);
  }

  const data = (await response.json()) as { IpfsHash?: string };

  if (!data.IpfsHash) {
    throw new Error("Pinata upload failed: missing IpfsHash");
  }

  return data.IpfsHash;
}
