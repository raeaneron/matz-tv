const API_BASE = 'https://api.iyad.space';

async function decrypt(encryptedBase64, keyString) {
  const binaryString = atob(encryptedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const iv = bytes.slice(0, 16);
  const ciphertext = bytes.slice(16);

  const keyBytes = new TextEncoder().encode(keyString);
  // Ensure key is 16 bytes (AES-128)
  const paddedKey = new Uint8Array(16);
  paddedKey.set(keyBytes.slice(0, 16));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    paddedKey,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export const iptvService = {
  async fetchChannels() {
    const tokenRes = await fetch(`${API_BASE}/token`);
    const { token } = await tokenRes.json();

    const keyRes = await fetch(`${API_BASE}/key`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { key } = await keyRes.json();

    const dataRes = await fetch(`${API_BASE}/data`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data } = await dataRes.json();

    const decryptedJson = await decrypt(data, key);
    const channels = JSON.parse(decryptedJson);

    return channels.filter(c => c.enabled !== false).map((c, index) => {
      const sources = [{ name: c.alt_name || "Stream 1", index: 0 }];
      for (let i = 2; i <= 10; i++) {
        const altName = c[`alt_name${i}`];
        if (altName) sources.push({ name: altName, index: i });
      }

      return {
        id: index + 1,
        name: c.name,
        category: c.tags && c.tags.length > 0 ? c.tags[0].toUpperCase() : 'LIVE TV',
        logo: c.logo || `https://placehold.co/300x170/222222/ffffff?text=${encodeURIComponent(c.name)}`,
        sources: sources
      };
    });
  },

  async fetchStream(channelName, serverIndex) {
    const tokenRes = await fetch(`${API_BASE}/token`);
    const { token } = await tokenRes.json();

    const keyRes = await fetch(`${API_BASE}/key`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { key } = await keyRes.json();

    const playRes = await fetch(`${API_BASE}/play`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelName, serverIndex: serverIndex || 0 })
    });

    if (!playRes.ok) throw new Error('Playback unauthorized');

    const { data } = await playRes.json();
    const decryptedJson = await decrypt(data, key);
    return JSON.parse(decryptedJson); // { url, type }
  }
};
