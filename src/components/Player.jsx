import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { X } from 'lucide-react';

export default function Player({ source, channelName, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!source) return;

    const video = videoRef.current;
    let hls;

    const defaultOptions = {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen',
      ],
      autoplay: true,
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.url;
      new Plyr(video, defaultOptions);
    } else if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(source.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        new Plyr(video, defaultOptions);
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [source]);

  return (
    <div className="relative w-full lg:max-w-5xl mx-auto mb-6 bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 mt-4">
      {/* Header Info - Simplified for old Safari */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <span className="px-2 py-1 bg-black/40 text-white font-medium rounded backdrop-blur-sm text-xs border border-white/10">
          {channelName}
        </span>
        <button 
          onClick={onClose} 
          className="p-2 bg-red-500/90 rounded-full text-white pointer-events-auto shadow-lg active:scale-95 transition-transform"
        >
          <X size={18} />
        </button>
      </div>

      <div className="w-full bg-black">
        <video 
          ref={videoRef} 
          controls 
          autoPlay 
          playsInline 
          className="w-full h-auto aspect-video" 
        />
      </div>
    </div>
  );
}
