import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Info, ExternalLink, RefreshCw } from 'lucide-react';
import Hls from 'hls.js';

export default function Player({ channel, onClose, onNext, onPrev }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [activeYoutubeId, setActiveYoutubeId] = useState(channel?.youtubeId || null);

  const isYouTube = !!(activeYoutubeId || channel?.handle || channel?.youtubeId);
  const streamUrl = channel?.hls || channel?.sources?.[0]?.url;

  // Resolve dynamic live ID for YouTube channels so they never expire or show private
  useEffect(() => {
    let isCancelled = false;
    setActiveYoutubeId(channel?.youtubeId || null);

    if (channel?.handle) {
      fetch(`/api/live-id?channel=${encodeURIComponent(channel.handle)}`)
        .then(r => r.json())
        .then(data => {
          if (!isCancelled && data?.videoId) {
            console.log(`Live ID resolved for ${channel.handle}:`, data.videoId);
            setActiveYoutubeId(data.videoId);
          }
        })
        .catch(err => {
          console.warn("Dynamic live-id fetch fallback:", err);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [channel]);

  // Handle HLS stream playback
  useEffect(() => {
    if (!channel) return;
    setError(null);
    setIsBuffering(true);

    if (isYouTube) {
      setIsBuffering(false);
      return;
    }

    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const cleanup = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };

    cleanup();
    video.playsInline = true;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      });
      playerRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data);
          if (!streamUrl.includes('/api/proxy')) {
            const proxied = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
            hls.loadSource(proxied);
          } else {
            setError("Stream is currently offline or unreachable.");
            setIsBuffering(false);
          }
        }
      });
      return cleanup;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setError("Unable to play stream on this browser.");
        setIsBuffering(false);
      });
      return cleanup;
    }

    setError("Browser does not support HLS streaming.");
    setIsBuffering(false);
    return cleanup;
  }, [channel, activeYoutubeId]);

  if (!channel) return null;

  const currentYtId = activeYoutubeId || channel.youtubeId;

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-4 group">
      {/* On-Screen Display (OSD) Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3.5 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity group-hover:opacity-100 opacity-75">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 bg-red-600 text-white font-black rounded text-[10px] tracking-wider shadow">
            CH {channel.ch || 'LIVE'}
          </span>
          <span className="text-white font-black text-sm truncate max-w-[200px] sm:max-w-[320px] drop-shadow">
            {channel.name}
          </span>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-white/40 hover:text-white transition p-1"
            title="Info"
          >
            <Info size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentYtId && (
            <a
              href={`https://www.youtube.com/watch?v=${currentYtId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-red-600 rounded-lg text-[10px] font-bold text-white transition"
              title="Watch on YouTube"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">YouTube</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-red-600 rounded-full text-white transition active:scale-90"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Screen Frame */}
      <div className="w-full bg-black flex items-center justify-center aspect-video relative">
        {/* Buffering Indicator */}
        {isBuffering && !error && !isYouTube && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
            <p className="text-zinc-500 text-xs">Tuning in...</p>
          </div>
        )}

        {/* Error Screen */}
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Channel Offline</h3>
            <p className="text-zinc-500 text-xs max-w-[280px] mb-5">{error}</p>
            <div className="flex gap-2">
              {onNext && (
                <button
                  onClick={onNext}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-bold transition shadow-lg"
                >
                  NEXT CHANNEL →
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}

        {/* Debug Box */}
        {showDebug && (
          <div className="absolute bottom-16 left-4 right-4 z-40 bg-black/85 p-3 rounded-lg text-[10px] font-mono text-green-400 break-all border border-green-500/20 max-h-[110px] overflow-auto pointer-events-none">
            CHANNEL: CH {channel.ch} - {channel.name}<br/>
            YT_ID: {currentYtId || 'None'}<br/>
            HANDLE: {channel.handle || 'None'}<br/>
            HLS: {streamUrl || 'None'}
          </div>
        )}

        {/* YouTube or HLS video player */}
        {isYouTube && currentYtId ? (
          <iframe
            key={currentYtId}
            src={`https://www.youtube-nocookie.com/embed/${currentYtId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
            className="w-full h-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={channel.name}
          />
        ) : (
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            className="w-full h-full"
            style={{ backgroundColor: 'black' }}
            crossOrigin="anonymous"
          />
        )}
      </div>

      {/* PinasDex Remote Control Bar */}
      <div className="bg-[#0f0f0f] border-t border-white/5 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
            <img src={channel.logo} alt="" className="w-full h-full object-cover rounded" />
          </div>
          <div className="overflow-hidden min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white">CH {channel.ch}</span>
              <span className="text-xs font-bold text-zinc-300 truncate">{channel.name}</span>
            </div>
            <p className="text-[10px] text-zinc-500 truncate">{channel.title || 'Live Broadcast'}</p>
          </div>
        </div>

        {/* Flipping Buttons */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {onPrev && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-200 transition active:scale-95"
              title="Previous channel"
            >
              ◀ CH-
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-bold text-white transition active:scale-95 shadow"
              title="Next channel"
            >
              CH+ ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
