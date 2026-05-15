import { useParams, Link } from 'react-router-dom'
import { channels } from '../data/channels'
import Hls from 'hls.js'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'

export default function Watch() {
  const { id } = useParams()
  const videoRef = useRef(null)

  const channel = channels.find(c => c.id == id)

  useEffect(() => {
    if (!channel) return

    const video = videoRef.current

    let hls;

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

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS playback support (e.g., Safari / iOS)
      video.src = channel.stream;
      new Plyr(video, defaultOptions);
    } else if (Hls.isSupported()) {
      // Use Hls.js
      hls = new Hls()
      hls.loadSource(channel.stream)
      hls.attachMedia(video)
      
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        new Plyr(video, defaultOptions);
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
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
