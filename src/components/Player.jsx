import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Play } from 'lucide-react';
import Hls from 'hls.js';

export default function Player({ source, channelName, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    if (!source || !videoRef.current) return;

    const video = videoRef.current;
    setError(null);
    setIsBuffering(true);

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isLegacyIOS = isIOS && (
      /OS 10_/.test(navigator.userAgent) || 
      /OS 9_/.test(navigator.userAgent) ||
      /OS 11_/.test(navigator.userAgent)
    );
    
    // Check for DASH/MPD incompatibility on legacy iOS
    if (source.type === 'mpd' && isLegacyIOS) {
      setError("This channel uses DASH (MPD) which is not supported on older iPads. Please try GTV or a different channel.");
      setIsBuffering(false);
      return;
    }

    // For iPad 4 (iOS 10) and other iOS devices, native HLS is much more reliable than hls.js
    if (isIOS || video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log("Using native HLS playback");
      video.src = source.url;
      
      const handleLoaded = () => {
        setIsBuffering(false);
        video.play().catch(e => console.log("Native play prevented", e));
      };
      
      const handleError = (e) => {
        console.error("Native playback error", e);
        if (source.type === 'mpd') {
          setError("DASH (MPD) streams are not supported on this device.");
        } else {
          setError("Stream unavailable or incompatible. Try a different server.");
        }
        setIsBuffering(false);
      };

      video.addEventListener('loadedmetadata', handleLoaded);
      video.addEventListener('error', handleError);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoaded);
        video.removeEventListener('error', handleError);
      };
    } 
    // Fallback to Hls.js for Chrome/Firefox/etc.
    else if (Hls.isSupported()) {
      console.log("Using Hls.js playback");
      const hls = new Hls({
        enableWorker: false, // Workers might fail on old browsers
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(source.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log("HLS play prevented", e));
        setIsBuffering(false);
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError("Failed to load stream. Please try another server.");
          setIsBuffering(false);
        }
      });
    } else {
      setError("Your browser does not support this video format.");
      setIsBuffering(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [source]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mb-6 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 mt-2">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
           <div className="px-1.5 py-0.5 bg-red-600 text-white font-bold rounded text-[9px] uppercase tracking-tighter">
             LIVE
           </div>
           <span className="text-white font-bold text-xs truncate max-w-[200px]">
             {channelName}
           </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 bg-white/10 hover:bg-red-600 rounded-full text-white transition active:scale-90"
        >
          <X size={16} />
        </button>
      </div>

      <div className="w-full bg-black flex items-center justify-center aspect-video relative">
        {isBuffering && !error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Playback Error</h3>
            <p className="text-zinc-500 text-[10px] max-w-[200px] mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 bg-red-600 rounded-lg text-xs font-bold transition active:scale-95"
            >
              RETRY
            </button>
          </div>
        )}

        <video 
          ref={videoRef} 
          controls 
          autoPlay 
          playsInline
          webkit-playsinline="true"
          className="w-full h-full"
          style={{ backgroundColor: 'black' }}
        />
      </div>
    </div>
  );
}
