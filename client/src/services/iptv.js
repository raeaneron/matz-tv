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
    const isYouTube = source.type === 'youtube' || finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be');

    if (isYouTube) {
      return { url: finalUrl, type: 'youtube' };
    }

    const streamType = source.type || (finalUrl.includes('.mpd') ? 'mpd' : 'hls');

    // Proxy insecure http:// streams to avoid browser mixed-content blocks
    if (finalUrl.startsWith('http://') || finalUrl.includes('.mpd')) {
      finalUrl = `${PROXY_PATH}?url=${encodeURIComponent(finalUrl)}`;
    }

    return { url: finalUrl, type: streamType };
  }
};
