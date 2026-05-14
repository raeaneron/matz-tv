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
    <div className="relative w-full max-w-4xl mx-auto mb-8 bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 mt-6 animate-fade-in">
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="p-2 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition backdrop-blur-sm">
          <X size={20} />
        </button>
      </div>
      <div className="absolute top-4 left-4 z-10">
        <span className="px-3 py-1 bg-black/50 text-white font-medium rounded-lg backdrop-blur-sm shadow text-sm border border-white/10">
          {channelName}
        </span>
      </div>
      <video ref={videoRef} controls autoPlay className="w-full aspect-video" />
    </div>
  );
}
