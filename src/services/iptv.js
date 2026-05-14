import CryptoJS from 'crypto-js';

const API_BASE = 'https://api.iyad.space';

async function decrypt(encryptedBase64, keyString) {
  try {
    const encryptedWA = CryptoJS.enc.Base64.parse(encryptedBase64);
    const iv = CryptoJS.lib.WordArray.create(encryptedWA.words.slice(0, 4), 16);
    const ciphertext = CryptoJS.lib.WordArray.create(encryptedWA.words.slice(4), encryptedWA.sigBytes - 16);
    const key = CryptoJS.enc.Utf8.parse(keyString.substring(0, 16));

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext },
      key,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) throw new Error("Decryption returned empty result");
    return result;
  } catch (e) {
    throw new Error(`Decryption failed: ${e.message}`);
  }
}

export const iptvService = {
  async fetchChannels() {
    try {
      const tokenRes = await fetch(`${API_BASE}/token`).catch(e => {
        throw new Error(`Connection blocked. This usually happens on old devices due to security certificates. Try using a newer browser or device.`);
      });
      
      if (!tokenRes.ok) throw new Error(`Server returned error ${tokenRes.status}`);
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

      if (!Array.isArray(channels)) throw new Error("Invalid channel data received");

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
    } catch (err) {
      throw err;
    }
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
    return JSON.parse(decryptedJson);
  }
};
