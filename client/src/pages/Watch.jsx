import { useParams, Link } from 'react-router-dom'
import { channels } from '../data/channels'
import Hls from 'hls.js'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'

const PROXY_PATH = '/api/proxy';

export default function Watch() {
  const { id } = useParams()
  const videoRef = useRef(null)

  const channel = channels.find(c => c.id == id)

  useEffect(() => {
    if (!channel) return

    const video = videoRef.current
    const source = channel.sources[0];
    if (!source) return;

    let streamUrl = source.url.trim();
    const streamType = source.type || (streamUrl.includes('.mpd') ? 'mpd' : 'hls');

    // Proxy http:// streams to avoid mixed-content on HTTPS
    if (streamUrl.startsWith('http://') || streamUrl.includes('.mpd')) {
      const ext = streamUrl.includes('.mpd') ? '/stream.mpd' : (streamUrl.includes('.m3u8') ? '/stream.m3u8' : '');
      streamUrl = `${PROXY_PATH}${ext}?url=${encodeURIComponent(streamUrl)}`;
    }

    let hls;
    let player;

    const defaultOptions = {
      controls: [
        'play-large',
        'restart',
        'rewind',
        'play',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'captions',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
      ],
    };

    if (streamType === 'mpd') {
      // DASH streams handled by shaka-player (loaded globally via CDN in index.html)
      if (window.shaka) {
        window.shaka.polyfill.installAll();
        const shakaPlayer = new window.shaka.Player(video);
        shakaPlayer.load(streamUrl).catch(console.error);
        player = shakaPlayer;
      } else {
        video.src = streamUrl;
        new Plyr(video, defaultOptions);
      }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari / iOS)
      video.src = streamUrl;
      new Plyr(video, defaultOptions);
    } else if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        new Plyr(video, defaultOptions);
      });
    }

    return () => {
      if (hls) hls.destroy();
      if (player && player.destroy) player.destroy();
    }
  }, [channel])

  if (!channel) {
    return <div className="p-5">Channel not found.</div>
  }

  return (
    <div className="p-5 flex flex-col h-screen max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/" className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold">
          {channel.name}
        </h1>
      </div>

      <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          controls
          autoPlay
          className="w-full h-full aspect-video"
        />
      </div>
    </div>
  )
}
