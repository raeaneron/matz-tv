import { channels as localChannels } from '../data/channels';

const API_BASE = '/api';
const PROXY_PATH = '/.netlify/functions/proxy';

export const iptvService = {
  async fetchChannels() {
    try {
      const response = await fetch(`${API_BASE}/channels`);
      if (!response.ok) throw new Error("Failed to fetch channels from proxy server");
      const channels = await response.json();
      if (!channels || channels.length === 0) throw new Error("Empty channel list");
      return channels;
    } catch (err) {
      console.warn("Remote API unavailable, using local channel list:", err.message);
      return localChannels;
    }
  },

  async fetchStream(channelName, serverIndex) {
    // First check if the local channel has a direct URL — use it immediately
    const localChannel = localChannels.find(c => c.name === channelName);
    if (localChannel) {
      const source = localChannel.sources[serverIndex] || localChannel.sources[0];
      if (source && source.url) {
        let finalUrl = source.url;
        
        // Proxy http:// streams to avoid mixed-content errors on Netlify (https)
        // Also proxy streams that might have CORS issues
        if (finalUrl.startsWith('http://') || finalUrl.includes('.mpd')) {
           const ext = finalUrl.includes('.m3u8') ? '/stream.m3u8' : (finalUrl.includes('.mpd') ? '/stream.mpd' : '');
           finalUrl = `${PROXY_PATH}${ext}?url=${encodeURIComponent(finalUrl)}`;
        }
        
        return { url: finalUrl, type: finalUrl.includes('.mpd') ? 'mpd' : 'hls' };
      }
    }

    // Otherwise fall back to the remote API
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
