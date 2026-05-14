import CryptoJS from 'crypto-js';

const API_BASE = 'https://api.iyad.space';

async function decrypt(encryptedBase64, keyString) {
  // Convert base64 string to CryptoJS WordArray
  const encryptedWA = CryptoJS.enc.Base64.parse(encryptedBase64);
  
  // Extract IV (first 16 bytes)
  const iv = CryptoJS.lib.WordArray.create(encryptedWA.words.slice(0, 4), 16);
  
  // Extract ciphertext (remaining bytes)
  const ciphertext = CryptoJS.lib.WordArray.create(encryptedWA.words.slice(4), encryptedWA.sigBytes - 16);

  // Parse key string (ensure it's treated as UTF-8)
  const key = CryptoJS.enc.Utf8.parse(keyString.substring(0, 16));

  // Decrypt using AES-CBC
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertext },
    key,
    { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );

  return decrypted.toString(CryptoJS.enc.Utf8);
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
