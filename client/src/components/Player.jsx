import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Shield, Info } from 'lucide-react';
import Hls from 'hls.js';

function detectStreamType(url, hintType) {
  if (!url) return hintType || 'hls';
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.m3u8')) return 'hls';
  if (lower.endsWith('.mpd')) return 'mpd';
  // Check if hintType is mpd or dash
  if (hintType && hintType.toLowerCase().includes('mpd')) return 'mpd';
  if (hintType && hintType.toLowerCase().includes('dash')) return 'mpd';
  return hintType || 'hls';
}

export default function Player({ source, channelName, onClose, availableSources, onSwitchSource }) {
  const videoRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const [error, setError] = useState(null);
  const [isDrmError, setIsDrmError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (!source || !videoRef.current) return;

    const video = videoRef.current;
    setError(null);
    setIsDrmError(false);
    setIsBuffering(true);

    const actualType = detectStreamType(source.url, source.type);
    const hasDrm = !!(source.key && source.keyId);

    const cleanup = async () => {
      if (playerInstanceRef.current) {
        if (playerInstanceRef.current.destroy) {
          try { await playerInstanceRef.current.destroy(); } catch (e) {}
        }
        playerInstanceRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };

    const initPlayer = async () => {
      await cleanup();

      // Install polyfills for older browsers
      if (window.shaka) {
        window.shaka.polyfill.installAll();
      }

      // Ensure we are playing inline (important for iOS)
      video.playsInline = true;

      // STRATEGY 1: DASH or DRM Streams (Requires Shaka Player)
      if (actualType === 'mpd' || hasDrm) {
        if (!window.shaka || !window.shaka.Player.isBrowserSupported()) {
          setError("Your browser does not support DASH or DRM streams.");
          setIsBuffering(false);
          return;
        }

        const shakaPlayer = new window.shaka.Player(video);
        playerInstanceRef.current = shakaPlayer;

        // Configure Shaka for DRM if needed
        if (hasDrm) {
          // Shaka correctly handles hex-encoded keys natively
          const clearKeys = {
            [source.keyId]: source.key
          };
          shakaPlayer.configure({
            drm: { clearKeys }
          });
        }

        shakaPlayer.addEventListener('error', (event) => {
          const err = event.detail;
          console.error("Shaka Player Error:", err);
          if (err.code === 6007 || err.code === 6001 || err.code === 6000) {
             setIsDrmError(true);
             setError("DRM Protected: This device does not support the required encryption.");
          } else {
             setError(`Playback Failed (Error Code: ${err.code}). Stream might be offline.`);
          }
          setIsBuffering(false);
        });

        try {
          await shakaPlayer.load(source.url);
          setIsBuffering(false);
          video.play().catch(e => console.log("Autoplay blocked"));
        } catch (e) {
          console.error("Shaka Load Error", e);
          if (e.code === 6007 || e.code === 6001) {
             setIsDrmError(true);
             setError("DRM Protected: Encryption not supported here.");
          } else {
             setError(`Failed to load stream (Code ${e.code}).`);
          }
          setIsBuffering(false);
        }
        return;
      }

      // STRATEGY 2: HLS Streams
      const supportsNativeHls = video.canPlayType('application/vnd.apple.mpegurl') || 
                                video.canPlayType('application/x-mpegURL');

      if (actualType === 'hls') {
        // Prefer Hls.js for non-Safari browsers
        if (Hls.isSupported() && !supportsNativeHls) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true
          });
          playerInstanceRef.current = hls;

          hls.loadSource(source.url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsBuffering(false);
            video.play().catch(e => console.log("Autoplay blocked"));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error("HLS.js Fatal Error:", data);
              setError("Stream unavailable. It might be blocked or offline.");
              setIsBuffering(false);
            }
          });
          return;
        }

        // Native fallback (Safari / iOS 10 iPad 4)
        if (supportsNativeHls) {
          video.src = source.url;
          video.addEventListener('loadedmetadata', () => {
             setIsBuffering(false);
             video.play().catch(e => console.log("Autoplay blocked"));
          });
          video.addEventListener('error', () => {
             console.error("Native Video Error", video.error);
             setError("Stream unavailable or incompatible with this device.");
             setIsBuffering(false);
          });
          return;
        }
      }

      setError("Unsupported stream format.");
      setIsBuffering(false);
    };

    // Delay slightly to ensure DOM is ready
    const timer = setTimeout(initPlayer, 100);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [source]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mb-6 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 mt-2 group">
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 bg-gradient-to-b from-black/90 to-transparent transition-opacity group-hover:opacity-100 opacity-60">
        <div className="flex items-center gap-2">
           <div className="px-1.5 py-0.5 bg-red-600 text-white font-bold rounded text-[9px] uppercase tracking-tighter shadow-sm">LIVE</div>
           <span className="text-white font-bold text-xs truncate max-w-[200px]">{channelName}</span>
           <button onClick={() => setShowDebug(!showDebug)} className="ml-2 text-white/30 hover:text-white transition">
             <Info size={14} />
           </button>
        </div>
        <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-red-600 rounded-full text-white transition active:scale-90">
          <X size={16} />
        </button>
      </div>

      <div className="w-full bg-black flex items-center justify-center aspect-video relative">
        {isBuffering && !error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
            {isDrmError ? <Shield className="w-10 h-10 text-yellow-500 mb-4" /> : <AlertCircle className="w-10 h-10 text-red-500 mb-4" />}
            <h3 className="text-sm font-bold text-white mb-2">{isDrmError ? 'DRM Protected' : 'Playback Failed'}</h3>
            <p className="text-zinc-500 text-[10px] sm:text-xs max-w-[300px] mb-6 leading-relaxed font-mono">{error}</p>
            
            <div className="flex flex-col gap-3 w-full max-w-[240px]">
               {availableSources && availableSources.length > 1 && (
                 <div className="flex flex-col gap-2">
                   <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Try another server:</p>
                   <div className="grid grid-cols-2 gap-2">
                     {availableSources.filter(s => s.name !== source.name).slice(0, 4).map((s, idx) => (
                       <button 
                         key={idx}
                         onClick={() => onSwitchSource(s)}
                         className="px-2 py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/20 rounded text-[9px] font-bold transition active:scale-95 text-red-500 hover:text-white"
                       >
                         {s.name}
                       </button>
                     ))}
                   </div>
                 </div>
               )}
               <button onClick={onClose} className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition active:scale-95 shadow-lg border border-white/5">
                 BACK TO LIST
               </button>
            </div>
          </div>
        )}

        {showDebug && (
          <div className="absolute bottom-16 left-4 right-4 z-40 bg-black/80 p-3 rounded text-[9px] font-mono text-green-500 break-all border border-green-500/20 max-h-[100px] overflow-auto pointer-events-none">
            URL: {source.url}<br/>
            TYPE: {detectStreamType(source.url, source.type)}<br/>
            DRM: {source.key ? 'YES' : 'NO'}<br/>
            UA: {navigator.userAgent}
          </div>
        )}

        <video 
          ref={videoRef} 
          controls 
          className="w-full h-full"
          style={{ backgroundColor: 'black' }}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      </div>
    </div>
  );
}
