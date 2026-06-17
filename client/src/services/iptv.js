const API_BASE = '/api';
const PROXY_PATH = '/api/proxy';

export const iptvService = {
  async fetchChannels() {
    try {
      const response = await fetch(`${API_BASE}/channels`);
      if (!response.ok) throw new Error("Failed to fetch channels from proxy server");
      const channels = await response.json();
      return channels;
    } catch (err) {
      console.error("Fetch channels error:", err);
      throw err;
    }
  },

  async fetchStream(channelName, serverIndex) {
    try {
      const playRes = await fetch(`${API_BASE}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channelName, serverIndex: parseInt(serverIndex) })
      });

      if (!playRes.ok) throw new Error("Stream request failed");

      const streamInfo = await playRes.json();
      
      // Robust key extraction
      const keyId = streamInfo.keyId || streamInfo.keyid || streamInfo.k_id;
      const decryptionKey = streamInfo.key || streamInfo.k || streamInfo.decryption_key;
      
      let finalUrl = streamInfo.url;
      
      // Proxy HLS streams from known restricted domains to ensure headers (Referer, Origin) are sent,
      // which is critical for legacy devices (iPad 4, iOS 10) that do not send these natively.
      const needsProxy = finalUrl && (
        finalUrl.includes('workers.dev') || 
        finalUrl.includes('conv.iyad.space') || 
        finalUrl.includes('alwaysdata.net')
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
