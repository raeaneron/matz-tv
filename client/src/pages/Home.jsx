import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { channels as channelList } from '../data/channels';
import { radioStations } from '../data/radio';

// ─── Retro CRT TV + Vintage Radio ───────────────────────────────────────────

const TV_CATEGORIES = ['ALL', 'PH LOCAL', 'NEWS', 'SPORTS', 'KIDS', 'INTERNATIONAL'];
const RADIO_REGIONS = ['ALL', 'Metro Manila', 'Luzon', 'Visayas', 'Mindanao', 'International'];
const REDUCE = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion:reduce)').matches;

// ═══════════════════════════════════════════════════════════════════════════
// RETRO TV SECTION
// ═══════════════════════════════════════════════════════════════════════════
function RetroTV({ audioRef }) {
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const snowRef = useRef(null);
  const hlsRef = useRef(null);
  const animRef = useRef(null);

  const [tvOn, setTvOn] = useState(false);
  const [tvState, setTvState] = useState('off'); // off | tuning | playing | paused | nosignal
  const [tvIdx, setTvIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [category, setCategory] = useState('ALL');
  const [activeYtId, setActiveYtId] = useState(null);
  const [isResolvingId, setIsResolvingId] = useState(false);

  const filtered = channelList.filter(c => category === 'ALL' || c.category === category);
  const channel = channelList[tvIdx] || null;

  // ── Snow canvas animation ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = snowRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const draw = () => {
      if (tvOn && tvState !== 'playing' && !REDUCE) {
        const d = ctx.createImageData(128, 72);
        for (let i = 0; i < d.data.length; i += 4) {
          const v = Math.random() * 200;
          d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
          d.data[i + 3] = 255;
        }
        ctx.putImageData(d, 0, 0);
      } else if (!tvOn || tvState === 'playing') {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, 128, 72);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    animRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [tvOn, tvState]);

  // ── HLS / YouTube loader ───────────────────────────────────────────────
  const killHls = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const v = videoRef.current;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  }, []);

  const loadChannel = useCallback((idx) => {
    const ch = channelList[idx];
    if (!ch) return;
    killHls();
    setActiveYtId(null);

    if (!tvOn) { setTvState('off'); return; }

    const isYT = !!(ch.handle || ch.youtubeId);

    if (isYT) {
      setTvState('tuning');
      setIsResolvingId(true);
      if (ch.handle) {
        fetch(`/api/live-id?channel=${encodeURIComponent(ch.handle)}`)
          .then(r => r.json())
          .then(data => {
            setActiveYtId(data?.videoId || ch.youtubeId || null);
            setIsResolvingId(false);
            setTvState(data?.videoId || ch.youtubeId ? 'playing' : 'nosignal');
          })
          .catch(() => {
            setActiveYtId(ch.youtubeId || null);
            setIsResolvingId(false);
            setTvState(ch.youtubeId ? 'playing' : 'nosignal');
          });
      } else {
        setActiveYtId(ch.youtubeId);
        setIsResolvingId(false);
        setTvState('playing');
      }
      return;
    }

    const url = ch.hls || ch.sources?.[0]?.url;
    if (!url) { setTvState('nosignal'); return; }

    setTvState('tuning');
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported() && url.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setTvState('paused'));
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (!url.includes('/api/proxy')) {
            hls.loadSource(`/api/proxy?url=${encodeURIComponent(url)}`);
          } else {
            setTvState('nosignal');
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => setTvState('paused'));
    } else {
      video.src = url;
      video.play().catch(() => setTvState('nosignal'));
    }
  }, [tvOn, killHls]);

  // Reload when tvOn or tvIdx changes
  useEffect(() => {
    loadChannel(tvIdx);
    return killHls;
  }, [tvIdx, tvOn]);

  // Video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlaying = () => setTvState('playing');
    const onWaiting = () => { if (tvOn) setTvState('tuning'); };
    const onPause = () => { if (tvOn && tvState === 'playing') setTvState('paused'); };
    const onError = () => { if (tvOn) setTvState('nosignal'); };
    const onPlay = () => {
      const a = audioRef.current;
      if (a && !a.paused) a.pause();
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    v.addEventListener('play', onPlay);
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
      v.removeEventListener('play', onPlay);
    };
  }, [tvOn, tvState, audioRef]);

  const handlePower = () => {
    const next = !tvOn;
    setTvOn(next);
    if (!next) { killHls(); setTvState('off'); setActiveYtId(null); }
  };
  const handleChUp = () => { setTvOn(true); setTvIdx(i => (i + 1) % channelList.length); };
  const handleChDown = () => { setTvOn(true); setTvIdx(i => (i - 1 + channelList.length) % channelList.length); };
  const handleMute = () => {
    const v = videoRef.current;
    if (v) { v.muted = !v.muted; setMuted(v.muted); }
  };
  const handleFull = () => {
    const el = document.getElementById('crt-screen');
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  };
  const handleScreenClick = () => {
    if (!tvOn) return;
    const v = videoRef.current;
    if (v && channel && !channel.handle && !channel.youtubeId) {
      v.paused ? v.play().catch(() => {}) : v.pause();
    }
  };

  const ch = channelList[tvIdx];
  const isYT = !!(ch?.handle || ch?.youtubeId);
  const osdText = tvOn ? `CH ${String(tvIdx + 1).padStart(2, '0')}  ${ch?.name || ''}` : '';
  const MSG = { off: '', tuning: 'Tuning…', nosignal: 'No signal', paused: 'Click to play', playing: '' };

  return (
    <section className="retro-tv" aria-label="Television">
      {/* Antenna */}
      <div className="ant" aria-hidden="true" />

      {/* Wooden Cabinet */}
      <div className="cab">
        {/* Bezel + Screen */}
        <div className="bezel">
          <div
            className="screen"
            id="crt-screen"
            title="Click to play or pause"
            onClick={handleScreenClick}
          >
            {/* Snow canvas (shown when not playing) */}
            <canvas
              ref={snowRef}
              width={128}
              height={72}
              style={{ opacity: tvOn && tvState !== 'playing' ? 1 : 0, zIndex: 1 }}
            />

            {/* HLS video */}
            {!isYT && (
              <video
                ref={videoRef}
                playsInline
                muted={muted}
                style={{ opacity: tvState === 'playing' ? 1 : 0, zIndex: 2 }}
              />
            )}

            {/* YouTube iframe — only mount after live-id resolves */}
            {isYT && tvOn && !isResolvingId && activeYtId && (
              <iframe
                key={activeYtId}
                src={`https://www.youtube-nocookie.com/embed/${activeYtId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&mute=${muted ? 1 : 0}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, zIndex: 2 }}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={ch?.name}
              />
            )}

            {/* Green phosphor OSD */}
            <div className="osd" style={{ zIndex: 3 }}>{tvOn ? osdText : ''}</div>

            {/* Status message */}
            {(tvState !== 'playing' || !tvOn) && (
              <div className="msg" role="status" aria-live="polite" style={{ zIndex: 4 }}>
                {MSG[tvState] || ''}
              </div>
            )}

            {/* Scanline + vignette overlay */}
            <div className="scanlines" aria-hidden="true" />
          </div>
        </div>

        {/* Side knobs */}
        <div className="side">
          <span className={`led${tvOn ? ' on' : ''}`} aria-hidden="true" />
          <button className="knob" onClick={handlePower} aria-label="Power" aria-pressed={tvOn}>Power</button>
          <button className="knob" onClick={handleChUp} aria-label="Next channel">Ch +</button>
          <button className="knob" onClick={handleChDown} aria-label="Previous channel">Ch −</button>
          <button className="knob" onClick={handleMute} aria-label="Mute" aria-pressed={muted}>Mute</button>
          <button className="knob" onClick={handleFull} aria-label="Full screen">Full</button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="chips">
        {TV_CATEGORIES.map(cat => (
          <button
            key={cat}
            className="chip"
            aria-pressed={category === cat}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
        <label style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          Vol
          <input
            type="range"
            min="0" max="1" step="0.01" defaultValue="1"
            aria-label="TV volume"
            onChange={e => { const v = videoRef.current; if (v) v.volume = e.target.value; }}
          />
        </label>
      </div>

      <p className="now">{tvOn && ch ? ch.title || 'Live Broadcast' : ''}</p>

      {/* Channel Guide */}
      <div className="guide" style={{ marginTop: 20 }}>
        <h2>Channel guide</h2>
        <ul>
          {filtered.map((c) => {
            const realIdx = channelList.indexOf(c);
            const isCur = realIdx === tvIdx && tvOn;
            return (
              <li key={c.id}>
                <button
                  aria-current={isCur}
                  onClick={() => { setTvOn(true); setTvIdx(realIdx); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <span className="num">{c.ch}</span>
                  <span>
                    <span className="nm">{c.name}</span>
                    <span className="in">{c.title || 'Live'}</span>
                  </span>
                  <span className="live">{isCur ? '● On' : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VINTAGE RADIO SECTION
// ═══════════════════════════════════════════════════════════════════════════
function VintageRadio({ audioRef }) {
  const hlsRef = useRef(null);
  const eqRef = useRef([]);
  const levRef = useRef(Array(22).fill(0.04));
  const animRef = useRef(null);

  const [rIdx, setRIdx] = useState(0);
  const [rPlaying, setRPlaying] = useState(false);
  const [rStatus, setRStatus] = useState('Stopped');
  const [region, setRegion] = useState('ALL');
  const [volume, setVolume] = useState(0.8);
  const [eqHeights, setEqHeights] = useState(Array(22).fill(4));

  const filtered = radioStations.filter(s => region === 'ALL' || s.region === region);
  const station = radioStations[rIdx];

  // Equalizer animation
  useEffect(() => {
    let raf;
    const tick = (t) => {
      const on = audioRef.current && !audioRef.current.paused && !audioRef.current.ended && audioRef.current.readyState > 2;
      const s = t / 1000;
      const N = 22;
      const lev = levRef.current;
      const newH = [];
      for (let i = 0; i < N; i++) {
        const tg = on
          ? (REDUCE ? 0.45 : (0.15 + 0.8 * Math.abs(Math.sin(s * (1.4 + i * 0.19) + i * 1.7)) * (0.65 + 0.35 * Math.random()) * (1 - i / N * 0.45)))
          : 0.04;
        lev[i] += (tg - lev[i]) * 0.25;
        newH.push(Math.max(4, lev[i] * 100));
      }
      levRef.current = lev;
      setEqHeights([...newH]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  const stopRadio = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    setRPlaying(false);
    setRStatus('Stopped');
  }, [audioRef]);

  const playStation = useCallback((idx) => {
    const s = radioStations[idx];
    if (!s?.url) { setRStatus('No signal'); return; }

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const a = audioRef.current;
    if (!a) return;

    a.pause();
    a.removeAttribute('src');
    setRStatus('Tuning…');
    setRPlaying(true);

    let url = s.url;
    if (url.startsWith('http://')) url = `/api/proxy?url=${encodeURIComponent(url)}`;

    if (s.url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(a);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          a.play().then(() => setRStatus('On air')).catch(() => setRStatus('No signal'));
        });
        hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setRStatus('No signal'); });
        return;
      }
    }

    a.volume = volume;
    a.src = url;
    a.play()
      .then(() => setRStatus('On air'))
      .catch(() => {
        if (!url.includes('/api/proxy')) {
          a.src = `/api/proxy?url=${encodeURIComponent(s.url)}`;
          a.play().then(() => setRStatus('On air')).catch(() => setRStatus('No signal'));
        } else {
          setRStatus('No signal');
          setRPlaying(false);
        }
      });
  }, [audioRef, volume]);

  const handlePlay = () => {
    if (rPlaying) {
      stopRadio();
    } else {
      playStation(rIdx);
    }
  };

  const handleChipClick = (idx) => {
    setRIdx(idx);
    playStation(idx);
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlaying = () => setRStatus('On air');
    const onPause = () => { if (!rPlaying) setRStatus('Stopped'); };
    const onWaiting = () => setRStatus('Tuning…');
    const onError = () => { if (a.getAttribute('src')) setRStatus('No signal'); };
    a.addEventListener('playing', onPlaying);
    a.addEventListener('pause', onPause);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('error', onError);
    };
  }, [audioRef, rPlaying]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume, audioRef]);

  const needlePct = radioStations.length > 1
    ? ((rIdx + 0.5) / radioStations.length * 100)
    : 50;

  return (
    <section className="radio" aria-label="Radio">
      {/* Speaker grille */}
      <div className="grille" aria-hidden="true" />

      {/* Amber LCD */}
      <div className="lcd">
        <div className="top">
          <span id="genre">{station?.genre || ''}</span>
          <span role="status" aria-live="polite">{rStatus}</span>
        </div>
        <div className="freq">{station?.frequency || ''}</div>
        <div className="name">{station?.name || ''}</div>
        <div className="desc">{station?.region || ''}</div>

        {/* Animated equalizer bars */}
        <div className="eq" aria-hidden="true">
          {eqHeights.map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* Analog frequency dial */}
      <div className="dial" aria-hidden="true">
        <div className="needle" style={{ left: `${needlePct}%` }} />
      </div>

      {/* Region filter + station preset chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {RADIO_REGIONS.map(r => (
          <button
            key={r}
            className="chip"
            aria-pressed={region === r}
            onClick={() => setRegion(r)}
            style={{ fontSize: 11, padding: '3px 10px' }}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="presets">
        {filtered.map((s) => {
          const realIdx = radioStations.indexOf(s);
          return (
            <button
              key={s.id}
              className="chip"
              aria-pressed={realIdx === rIdx}
              onClick={() => handleChipClick(realIdx)}
            >
              {s.frequency} {s.name}
            </button>
          );
        })}
      </div>

      {/* Play knob + volume */}
      <div className="ctrl">
        <button
          className="knob play"
          id="radio-play"
          aria-label={rPlaying ? 'Pause radio' : 'Play radio'}
          onClick={handlePlay}
        >
          {rPlaying && rStatus === 'On air' ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min="0" max="1" step="0.01"
          value={volume}
          aria-label="Radio volume"
          onChange={e => setVolume(parseFloat(e.target.value))}
        />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function Home() {
  const audioRef = useRef(null);

  return (
    <>
      {/* Shared audio element for radio */}
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />

      <main>
        <h1>Live TV and Radio</h1>
        <p className="sub">Pick a channel to watch, or tune the radio and let it play in the background.</p>

        <div className="grid">
          <RetroTV audioRef={audioRef} />

          <div className="right">
            <VintageRadio audioRef={audioRef} />
          </div>
        </div>
      </main>
    </>
  );
}
