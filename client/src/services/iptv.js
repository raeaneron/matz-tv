import CryptoJS from 'crypto-js';

const API_BASE = 'https://api.iyad.space';
const PROXY_PATH = window.location.hostname === 'localhost' ? 'http://localhost:5000/api/proxy' : '/api/proxy';

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
    if (!result) throw new Error("Empty result");
    return result;
  } catch (e) {
    throw new Error(`Decryption failed: ${e.message}`);
  }
}

export const iptvService = {
  async fetchChannels() {
    try {
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

      return channels.filter(c => {
        if (c.enabled !== false) return true;
        const name = (c.name || '').toLowerCase();
        return name.includes('gma') || name.includes('kapamilya');
      }).map((c, index) => {
        const sources = [{ name: c.alt_name || "Server 1", index: 0 }];
        for (let i = 2; i <= 10; i++) {
          if (c[`alt_name${i}`]) sources.push({ name: c[`alt_name${i}`], index: i });
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
      console.error("Fetch channels error:", err);
      throw err;
    }
  },

  async fetchStream(channelName, serverIndex) {
    try {
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
        body: JSON.stringify({ channelName, serverIndex: parseInt(serverIndex) })
      });

      if (!playRes.ok) throw new Error("Stream request failed");

      const { data } = await playRes.json();
      const decryptedJson = await decrypt(data, key);
      const streamInfo = JSON.parse(decryptedJson);
      
      // Robust key extraction
      const keyId = streamInfo.keyId || streamInfo.keyid || streamInfo.k_id;
      const decryptionKey = streamInfo.key || streamInfo.k || streamInfo.decryption_key;
      
      let finalUrl = streamInfo.url;
      
      // Proxy HLS streams and restricted domains to ensure headers (Referer, Origin) are sent,
      // which is critical for legacy devices (iPad 4, iOS 10) that do not send these natively.
      const needsProxy = finalUrl && (
        finalUrl.includes('workers.dev') || 
        finalUrl.includes('conv.iyad.space') || 
        finalUrl.includes('alwaysdata.net') || 
        finalUrl.includes('.m3u8')
      );

      if (needsProxy) {
        const ext = finalUrl.includes('.m3u8') ? '/stream.m3u8' : (finalUrl.includes('.mpd') ? '/stream.mpd' : '');
        finalUrl = `${PROXY_PATH}${ext}?url=${encodeURIComponent(finalUrl)}`;
      }

      return {
        ...streamInfo,
        url: finalUrl,
        keyId: keyId,
        key: decryptionKey
      };
    } catch (err) {
      console.error("Fetch stream error:", err);
      throw err;
    }
  }
};
