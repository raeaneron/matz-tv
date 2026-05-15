const API_BASE = '/api';

export const iptvService = {
  async fetchChannels() {
    try {
      const response = await fetch(`${API_BASE}/channels`);
      if (!response.ok) {
        throw new Error(`Failed to load channels: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error("IPTV Service Error (fetchChannels):", err);
      throw err;
    }
  },

  async fetchStream(channelName, serverIndex) {
    try {
      const response = await fetch(`${API_BASE}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channelName, serverIndex: serverIndex || 0 })
      });

      if (!response.ok) {
        throw new Error(`Failed to load stream: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error("IPTV Service Error (fetchStream):", err);
      throw err;
    }
  }
};
