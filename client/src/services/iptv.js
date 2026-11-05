import { channels as localChannels } from '../data/channels';

const PROXY_PATH = '/api/proxy';

export const iptvService = {
  async fetchChannels() {
    return localChannels;
  },

  async fetchStream(channelName, serverIndex) {
    const localChannel = localChannels.find(c => c.name === channelName);
    if (!localChannel) {
      throw new Error(`Channel not found: ${channelName}`);
    }

    const source = localChannel.sources[serverIndex] || localChannel.sources[0];
    if (!source || !source.url) {
      throw new Error(`No stream source for: ${channelName}`);
    }

    let finalUrl = source.url.trim();
    const streamType = source.type || (finalUrl.includes('.mpd') ? 'mpd' : 'hls');

    // Proxy http:// streams to avoid mixed-content errors on HTTPS Netlify site
    if (finalUrl.startsWith('http://') || finalUrl.includes('.mpd')) {
      const ext = finalUrl.includes('.mpd') ? '/stream.mpd' : (finalUrl.includes('.m3u8') ? '/stream.m3u8' : '');
      finalUrl = `${PROXY_PATH}${ext}?url=${encodeURIComponent(finalUrl)}`;
    }

    return { url: finalUrl, type: streamType };
  }
};
