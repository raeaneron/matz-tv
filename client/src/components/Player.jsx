import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Shield, Info } from 'lucide-react';
import Hls from 'hls.js';

function detectStreamType(url, hintType) {
  if (hintType === 'youtube') return 'youtube';
  if (!url) return hintType || 'hls';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';

  let checkUrl = url;
  try { checkUrl = decodeURIComponent(url); } catch (e) {}
  const lower = checkUrl.toLowerCase();
  if (lower.includes('.mpd')) return 'mpd';
  if (lower.includes('.m3u8')) return 'hls';
  if (hintType && hintType.toLowerCase().includes('mpd')) return 'mpd';
  return hintType || 'hls';
}

let globalLastChannelName = "";
if (!window.globalTriedSources) {
  window.globalTriedSources = new Set();
}
const globalTriedSources = window.globalTriedSources;

export default function Player({ source, channelName, onClose, availableSources, onSwitchSource }) {
  const videoRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const [error, setError] = useState(null);
  const [isDrmError, setIsDrmError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  if (channelName !== globalLastChannelName) {
    globalTriedSources.clear();
    globalLastChannelName = channelName;
  }

  const actualType = detectStreamType(source?.url, source?.type);

  useEffect(() => {
    if (!source) return;

    setError(null);
    setIsDrmError(false);
    setIsBuffering(true);
    globalTriedSources.add(source.name);

    // YouTube Stream
    if (actualType === 'youtube') {
      setIsBuffering(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const hasDrm = !!(source.key && source.keyId);

    const cleanup = async () => {
      if (playerInstanceRef.current) {
        if (playerInstanceRef.current.destroy) {
          try { await playerInstanceRef.current.destroy(); } catch (e) {}
        }
        playerInstanceRef.current = null;
      }
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };

    const tryFallback = (errorMsg, isDrm = false) => {
      if (availableSources && availableSources.length > 1) {
        const nextSource = availableSources.find(s => !globalTriedSources.has(s.name));
        if (nextSource) {
          console.log("Switching to next server:", nextSource.name);
          onSwitchSource(nextSource);
          return;
        }
      }
      setIsDrmError(isDrm);
      setError(errorMsg);
      setIsBuffering(false);
    };

    const initPlayer = async () => {
      await cleanup();
      video.playsInline = true;

      // STRATEGY 1: DASH / MPD (Shaka)
      if (actualType === 'mpd' || hasDrm) {
        if (!window.shaka || !window.shaka.Player.isBrowserSupported()) {
          tryFallback("Your browser does not support DASH streams.");
          return;
        }

        window.shaka.polyfill.installAll();
        const shakaPlayer = new window.shaka.Player(video);
        playerInstanceRef.current = shakaPlayer;

        // Proxy all http requests to bypass mixed content
        shakaPlayer.getNetworkingEngine().registerRequestFilter((_type, request) => {
          const uri = request.uris[0];
          if (uri && uri.startsWith('http://')) {
            request.uris[0] = `/api/proxy?url=${encodeURIComponent(uri)}`;
          }
        });

        if (hasDrm) {
          shakaPlayer.configure({ drm: { clearKeys: { [source.keyId]: source.key } } });
        }

        shakaPlayer.addEventListener('error', (event) => {
          console.error("Shaka Error:", event.detail);
          tryFallback("Stream offline or unavailable.");
        });

        try {
          await shakaPlayer.load(source.url);
          setIsBuffering(false);
          video.play().catch(() => {});
        } catch (e) {
          tryFallback("Failed to load stream.");
        }
        return;
      }

      // STRATEGY 2: HLS Streams
      const supportsNativeHls = video.canPlayType('application/vnd.apple.mpegurl') ||
                                video.canPlayType('application/x-mpegURL');

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        });
        playerInstanceRef.current = hls;

        hls.loadSource(source.url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("HLS fatal error:", data);
            // If direct HLS failed, try proxying the URL
            if (!source.url.includes('/proxy')) {
              const proxiedUrl = `/api/proxy?url=${encodeURIComponent(source.url)}`;
              console.log("Retrying HLS through proxy:", proxiedUrl);
              hls.loadSource(proxiedUrl);
            } else {
              tryFallback("Stream unavailable or offline.");
            }
          }
        });
        return;
      }

      // Native HLS (Safari)
      if (supportsNativeHls) {
        video.src = source.url;
        video.addEventListener('loadedmetadata', () => {
          setIsBuffering(false);
          video.play().catch(() => {});
        });
        video.addEventListener('error', () => {
          tryFallback("Playback error on this device.");
        });
        return;
      }

      tryFallback("Unsupported stream format.");
    };

    const timer = setTimeout(initPlayer, 100);
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [source]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mb-6 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 mt-2 group">
      {/* Top Header */}
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
        {/* Buffering Indicator */}
        {isBuffering && !error && actualType !== 'youtube' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
        )}

        {/* Error Screen */}
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
            {isDrmError ? <Shield className="w-10 h-10 text-yellow-500 mb-4" /> : <AlertCircle className="w-10 h-10 text-red-500 mb-4" />}
            <h3 className="text-sm font-bold text-white mb-2">{isDrmError ? 'DRM Protected' : 'Playback Failed'}</h3>
            <p className="text-zinc-500 text-[10px] sm:text-xs max-w-[300px] mb-6 leading-relaxed font-mono">{error}</p>

            <div className="flex flex-col w-full max-w-[240px]">
              {availableSources && availableSources.length > 1 && (
                <div className="flex flex-col mb-3">
                  <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-2">Try another server:</p>
                  <div className="grid grid-cols-2">
                    {availableSources.filter(s => s.name !== source.name).map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSwitchSource(s)}
                        className="px-2 py-2 m-1 bg-red-600/10 hover:bg-red-600 border border-red-500/20 rounded text-[9px] font-bold transition active:scale-95 text-red-500 hover:text-white"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={onClose} className="px-5 py-2 mt-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition active:scale-95 shadow-lg border border-white/5">
                BACK TO LIST
              </button>
            </div>
          </div>
        )}

        {/* Debug Box */}
        {showDebug && (
          <div className="absolute bottom-16 left-4 right-4 z-40 bg-black/80 p-3 rounded text-[9px] font-mono text-green-500 break-all border border-green-500/20 max-h-[100px] overflow-auto pointer-events-none">
            URL: {source?.url}<br/>
            TYPE: {actualType}<br/>
            SOURCE: {source?.name}
          </div>
        )}

        {/* YouTube Stream Embed */}
        {actualType === 'youtube' ? (
          <iframe
            src={source.url}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={channelName}
          />
        ) : (
          <video
            ref={videoRef}
            controls
            className="w-full h-full"
            style={{ backgroundColor: 'black' }}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        )}
      </div>
    </div>
  );
}
