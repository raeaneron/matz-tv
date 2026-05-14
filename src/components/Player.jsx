import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Player({ source, channelName, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!source || !videoRef.current) return;

    const video = videoRef.current;
    
    // On iOS/Safari 10, we should use native HLS playback directly.
    // We don't need Hls.js or Plyr which might be too heavy or incompatible.
    video.src = source.url;
    
    // Attempt to play
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Autoplay prevented:", error);
      });
    }
  }, [source]);

  return (
    <div className="relative w-full lg:max-w-5xl mx-auto mb-6 bg-black rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10 mt-2">
      {/* Native-style header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-2 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-2">
           <span className="px-2 py-0.5 bg-red-600 text-white font-bold rounded text-[10px] uppercase tracking-wider">
             LIVE
           </span>
           <span className="text-white font-semibold text-xs drop-shadow-md">
             {channelName}
           </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors"
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="w-full bg-black flex items-center justify-center aspect-video">
        <video 
          ref={videoRef} 
          controls 
          autoPlay 
          playsInline
          webkit-playsinline="true"
          className="w-full h-full max-h-[70vh]"
          style={{ backgroundColor: 'black' }}
        >
          <source src={source.url} type="application/x-mpegURL" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}
