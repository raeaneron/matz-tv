import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

export default function Player({ source, channelName, onClose }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    if (!source || !videoRef.current) return;

    const video = videoRef.current;
    setError(null);
    setIsBuffering(true);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Cleanup function
    const cleanup = async () => {
      if (playerRef.current) {
        try {
          await playerRef.current.destroy();
        } catch (e) {
          console.error("Cleanup error", e);
        }
        playerRef.current = null;
      }
    };

    const initPlayer = async () => {
      // 1. Try Shaka Player for DASH and DRM support (Most robust, like iYAD TV)
      if (window.shaka && window.shaka.Player.isBrowserSupported()) {
        const shakaPlayer = new window.shaka.Player(video);
        playerRef.current = shakaPlayer;

        // Configure ClearKey DRM if keys are present
        if (source.key && source.keyId) {
          shakaPlayer.configure({
            drm: {
              clearKeys: {
                [source.keyId]: source.key
              }
            }
          });
        }

        shakaPlayer.addEventListener('error', (event) => {
          console.error('Shaka Error:', event.detail);
          if (event.detail.code === 1001) return; // Ignore some non-fatal errors
          setError(`Player Error (${event.detail.code})`);
          setIsBuffering(false);
        });

        try {
          await shakaPlayer.load(source.url);
          setIsBuffering(false);
          video.play().catch(e => console.log("Shaka play prevented", e));
          return;
        } catch (e) {
          console.error('Shaka Load Error:', e);
          // Fall through to native if Shaka fails
        }
      }

      // 2. Fallback to Native HLS (Essential for iPad 4 / iOS 10)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("Using native HLS fallback");
        video.src = source.url;
        
        video.onloadedmetadata = () => {
          setIsBuffering(false);
          video.play().catch(e => console.log("Native play prevented", e));
        };
        
        video.onerror = () => {
          console.error("Native error", video.error);
          if (source.type === 'mpd') {
            setError("DASH (MPD) format is not supported on this device. Try a different server.");
          } else {
            setError("Stream unavailable or incompatible with this device.");
          }
          setIsBuffering(false);
        };
      } else {
        setError("Your browser does not support this stream format.");
        setIsBuffering(false);
      }
    };

    initPlayer();

    return () => {
      cleanup();
    };
  }, [source]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mb-6 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 mt-2">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
           <div className="px-1.5 py-0.5 bg-red-600 text-white font-bold rounded text-[9px] uppercase tracking-tighter shadow-sm">
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <h3 className="text-sm font-bold text-white mb-2">Playback Failed</h3>
            <p className="text-zinc-500 text-[10px] sm:text-xs max-w-[250px] mb-6 leading-relaxed">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-bold transition active:scale-95 shadow-lg"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              REFRESH PLAYER
            </button>
          </div>
        )}

        <video 
          ref={videoRef} 
          controls 
          autoPlay 
          playsInline
          referrerPolicy="no-referrer"
          className="w-full h-full"
          style={{ backgroundColor: 'black' }}
        />
      </div>
    </div>
  );
}
