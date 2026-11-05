import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { channels as channelList } from '../data/channels';
import { radioStations } from '../data/radio';

const TV_CATEGORIES = ['ALL', 'PH LOCAL', 'NEWS', 'SPORTS', 'KIDS', 'INTERNATIONAL'];
const RADIO_REGIONS = ['ALL', 'Metro Manila', 'Luzon', 'Visayas', 'Mindanao', 'International'];
const REDUCE = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion:reduce)').matches;

// ═══════════════════════════════════════════════════════════════════════════
// RETRO TV PAGE
// ═══════════════════════════════════════════════════════════════════════════
function RetroTV({ audioRef }) {
  const videoRef   = useRef(null);
  const snowRef    = useRef(null);
  const hlsRef     = useRef(null);

  const [tvOn,         setTvOn]         = useState(false);
  const [tvState,      setTvState]      = useState('off');
  const [tvIdx,        setTvIdx]        = useState(0);
  const [muted,        setMuted]        = useState(false);
  const [category,     setCategory]     = useState('ALL');
  const [activeYtId,   setActiveYtId]   = useState(null);
  const [isResolving,  setIsResolving]  = useState(false);

  const filtered = channelList.filter(c => category === 'ALL' || c.category === category);

  /* Snow canvas */
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
          d.data[i] = d.data[i+1] = d.data[i+2] = v;
          d.data[i+3] = 255;
        }
        ctx.putImageData(d, 0, 0);
      } else {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, 128, 72);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tvOn, tvState]);

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
      if (ch.handle) {
        setIsResolving(true);
        fetch(`/api/live-id?channel=${encodeURIComponent(ch.handle)}`)
          .then(r => r.json())
          .then(data => {
            const id = data?.videoId || ch.youtubeId || null;
            setActiveYtId(id);
            setIsResolving(false);
            setTvState(id ? 'playing' : 'nosignal');
          })
          .catch(() => {
            setActiveYtId(ch.youtubeId || null);
            setIsResolving(false);
            setTvState(ch.youtubeId ? 'playing' : 'nosignal');
          });
      } else {
        setActiveYtId(ch.youtubeId);
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
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => setTvState('paused')));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (!url.includes('/api/proxy')) hls.loadSource(`/api/proxy?url=${encodeURIComponent(url)}`);
          else setTvState('nosignal');
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

  useEffect(() => { loadChannel(tvIdx); return killHls; }, [tvIdx, tvOn]);

  /* Video events */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handlers = {
      playing: () => setTvState('playing'),
      waiting:  () => { if (tvOn) setTvState('tuning'); },
      pause:    () => { if (tvOn && tvState === 'playing') setTvState('paused'); },
      error:    () => { if (tvOn) setTvState('nosignal'); },
      play:     () => { const a = audioRef.current; if (a && !a.paused) a.pause(); },
    };
    Object.entries(handlers).forEach(([ev, fn]) => v.addEventListener(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => v.removeEventListener(ev, fn));
  }, [tvOn, tvState, audioRef]);

  const handlePower    = () => { const n = !tvOn; setTvOn(n); if (!n) { killHls(); setTvState('off'); setActiveYtId(null); } };
  const handleChUp     = () => { setTvOn(true); setTvIdx(i => (i + 1) % channelList.length); };
  const handleChDown   = () => { setTvOn(true); setTvIdx(i => (i - 1 + channelList.length) % channelList.length); };
  const handleMute     = () => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } };
  const handleFull     = () => {
    const el = document.getElementById('crt-screen');
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement)
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    else
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };
  const handleScreenClick = () => {
    if (!tvOn) return;
    const ch = channelList[tvIdx];
    if (ch?.handle || ch?.youtubeId) return; // iframe handles its own clicks
    const v = videoRef.current;
    if (v) v.paused ? v.play().catch(() => {}) : v.pause();
  };

  const ch     = channelList[tvIdx];
  const isYT   = !!(ch?.handle || ch?.youtubeId);
  const osd    = tvOn ? `CH ${String(tvIdx + 1).padStart(2, '0')}  ${ch?.name || ''}` : '';
  const MSG    = { off: '', tuning: 'Tuning…', nosignal: 'No signal', paused: 'Click to play', playing: '' };

  return (
    <div className="tv-page">
      {/* ── Left: CRT cabinet ── */}
      <section className="retro-tv" aria-label="Television">
        <div className="ant" aria-hidden="true" />
        <div className="cab">
          <div className="bezel">
            <div className="screen" id="crt-screen" title="Click to play / pause" onClick={handleScreenClick}>
              <canvas ref={snowRef} width={128} height={72}
                style={{ opacity: (tvOn && tvState !== 'playing') ? 1 : 0, zIndex: 1 }} />

              {!isYT && (
                <video ref={videoRef} playsInline muted={muted}
                  style={{ opacity: tvState === 'playing' ? 1 : 0, zIndex: 2 }} />
              )}

              {isYT && tvOn && !isResolving && activeYtId && (
                <iframe key={activeYtId}
                  src={`https://www.youtube-nocookie.com/embed/${activeYtId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&mute=${muted ? 1 : 0}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, zIndex: 2 }}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title={ch?.name}
                />
              )}

              <div className="osd" style={{ zIndex: 11 }}>{osd}</div>
              {(tvState !== 'playing' || !tvOn) && (
                <div className="msg" role="status" aria-live="polite" style={{ zIndex: 11 }}>
                  {MSG[tvState] || ''}
                </div>
              )}
              <div className="scanlines" aria-hidden="true" />
            </div>
          </div>

          <div className="side">
            <span className={`led${tvOn ? ' on' : ''}`} aria-hidden="true" />
            <button className="knob" onClick={handlePower}  aria-label="Power"          aria-pressed={tvOn}>Power</button>
            <button className="knob" onClick={handleChUp}   aria-label="Next channel">Ch +</button>
            <button className="knob" onClick={handleChDown} aria-label="Prev channel">Ch −</button>
            <button className="knob" onClick={handleMute}   aria-label="Mute"           aria-pressed={muted}>Mute</button>
            <button className="knob" onClick={handleFull}   aria-label="Full screen">Full</button>
          </div>
        </div>

        {/* Category chips + volume */}
        <div className="chips">
          {TV_CATEGORIES.map(cat => (
            <button key={cat} className="chip" aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}</button>
          ))}
          <label style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            Vol
            <input type="range" min="0" max="1" step="0.01" defaultValue="1" aria-label="TV volume"
              onChange={e => { const v = videoRef.current; if (v) v.volume = e.target.value; }} />
          </label>
        </div>

        {/* Currently playing with logo */}
        <div className="now-bar">
          {tvOn && ch && (
            <div className="now-content">
              {ch.logo && (
                <img src={ch.logo} alt="" className="now-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
              )}
              <span className="now-text">{ch.title || ch.name}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Right: Channel guide with Logos ── */}
      <section className="guide" aria-label="Channel guide">
        <h2>Channel guide</h2>
        <ul>
          {filtered.map(c => {
            const realIdx = channelList.indexOf(c);
            const isCur   = realIdx === tvIdx && tvOn;
            return (
              <li key={c.id}>
                <button aria-current={isCur}
                  onClick={() => { setTvOn(true); setTvIdx(realIdx); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <span className="num">{c.ch}</span>
                  <div className="guide-logo-box">
                    <img src={c.logo} alt="" className="guide-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
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
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VINTAGE RADIO PAGE
// ═══════════════════════════════════════════════════════════════════════════
function VintageRadio({ audioRef }) {
  const hlsRef  = useRef(null);
  const levRef  = useRef(Array(22).fill(0.04));

  const [rIdx,      setRIdx]      = useState(0);
  const [rPlaying,  setRPlaying]  = useState(false);
  const [rStatus,   setRStatus]   = useState('Stopped');
  const [region,    setRegion]    = useState('ALL');
  const [volume,    setVolume]    = useState(0.8);
  const [eqH,      setEqH]       = useState(Array(22).fill(4));

  const filtered = radioStations.filter(s => region === 'ALL' || s.region === region);
  const station  = radioStations[rIdx];

  /* Equalizer animation */
  useEffect(() => {
    let raf;
    const tick = (t) => {
      const a  = audioRef.current;
      const on = a && !a.paused && !a.ended && a.readyState > 2;
      const s  = t / 1000;
      const lev = levRef.current;
      const newH = lev.map((l, i) => {
        const tg = on
          ? (REDUCE ? 0.45 : 0.15 + 0.8 * Math.abs(Math.sin(s * (1.4 + i * 0.19) + i * 1.7)) * (0.65 + 0.35 * Math.random()) * (1 - i / 22 * 0.45))
          : 0.04;
        const nl = l + (tg - l) * 0.25;
        lev[i] = nl;
        return Math.max(4, nl * 100);
      });
      levRef.current = lev;
      setEqH([...newH]);
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
    a.pause(); a.removeAttribute('src');
    setRStatus('Tuning…'); setRPlaying(true);

    let url = s.url.startsWith('http://') ? `/api/proxy?url=${encodeURIComponent(s.url)}` : s.url;

    if (s.url.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(a);
      hls.on(Hls.Events.MANIFEST_PARSED, () => a.play().then(() => setRStatus('On air')).catch(() => setRStatus('No signal')));
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setRStatus('No signal'); });
      return;
    }

    a.volume = volume;
    a.src = url;
    a.play()
      .then(() => setRStatus('On air'))
      .catch(() => {
        if (!url.includes('/api/proxy')) {
          a.src = `/api/proxy?url=${encodeURIComponent(s.url)}`;
          a.play().then(() => setRStatus('On air')).catch(() => { setRStatus('No signal'); setRPlaying(false); });
        } else { setRStatus('No signal'); setRPlaying(false); }
      });
  }, [audioRef, volume]);

  const handleNextStation = () => {
    const nextIdx = (rIdx + 1) % radioStations.length;
    setRIdx(nextIdx);
    playStation(nextIdx);
  };

  const handlePrevStation = () => {
    const prevIdx = (rIdx - 1 + radioStations.length) % radioStations.length;
    setRIdx(prevIdx);
    playStation(prevIdx);
  };

  /* Audio events */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const handlers = {
      playing: () => setRStatus('On air'),
      pause:   () => { if (!rPlaying) setRStatus('Stopped'); },
      waiting: () => setRStatus('Tuning…'),
      error:   () => { if (a.getAttribute('src')) setRStatus('No signal'); },
    };
    Object.entries(handlers).forEach(([ev, fn]) => a.addEventListener(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => a.removeEventListener(ev, fn));
  }, [audioRef, rPlaying]);

  useEffect(() => { const a = audioRef.current; if (a) a.volume = volume; }, [volume, audioRef]);
  useEffect(() => () => stopRadio(), []);

  const needlePct = radioStations.length > 1 ? (rIdx + 0.5) / radioStations.length * 100 : 50;

  return (
    <div className="radio-page">
      {/* ── Left: Vintage Radio Receiver ── */}
      <section className="radio" aria-label="Radio">
        <div className="grille" aria-hidden="true" />

        <div className="lcd">
          <div className="top">
            <span>{station?.genre || ''}</span>
            <span role="status" aria-live="polite" className={`rstatus-badge ${rPlaying && rStatus === 'On air' ? 'live' : ''}`}>{rStatus}</span>
          </div>

          <div className="lcd-main">
            <div className="lcd-info">
              <div className="freq">{station?.frequency || ''}</div>
              <div className="name">{station?.name || ''}</div>
              <div className="desc">{station?.region || ''}</div>
            </div>
            {station?.logo && (
              <div className="lcd-logo-box">
                <img
                  src={station.logo}
                  alt={station.name}
                  className="lcd-logo"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          <div className="eq" aria-hidden="true">
            {eqH.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
          </div>
        </div>

        <div className="dial" aria-hidden="true">
          <div className="needle" style={{ left: `${needlePct}%` }} />
        </div>

        {/* Station presets chips */}
        <div className="presets">
          {radioStations.slice(0, 8).map(s => {
            const realIdx = radioStations.indexOf(s);
            return (
              <button key={s.id} className="chip" aria-pressed={realIdx === rIdx}
                onClick={() => { setRIdx(realIdx); playStation(realIdx); }}>
                {s.frequency.split(' ')[0]} {s.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Controls: Prev, Play/Pause, Next, Volume */}
        <div className="ctrl">
          <button className="knob rknob" onClick={handlePrevStation} aria-label="Previous station" title="Previous station">
            ◀ Stn
          </button>
          <button className="knob play" aria-label={rPlaying ? 'Pause radio' : 'Play radio'}
            onClick={() => rPlaying ? stopRadio() : playStation(rIdx)} title={rPlaying ? 'Pause' : 'Play'}>
            {rPlaying && rStatus === 'On air' ? '❚❚' : '▶'}
          </button>
          <button className="knob rknob" onClick={handleNextStation} aria-label="Next station" title="Next station">
            Stn ▶
          </button>
          <div className="rvol-wrap">
            <span className="vol-lbl">Vol</span>
            <input type="range" min="0" max="1" step="0.01" value={volume}
              aria-label="Radio volume"
              onChange={e => setVolume(parseFloat(e.target.value))} />
          </div>
        </div>
      </section>

      {/* ── Right: Radio Station Guide with Logos ── */}
      <section className="guide" aria-label="Radio station guide">
        <h2>Radio guide</h2>

        {/* Region filter chips */}
        <div className="chips radio-filter-chips">
          {RADIO_REGIONS.map(r => (
            <button key={r} className="chip" aria-pressed={region === r}
              onClick={() => setRegion(r)}>
              {r}
            </button>
          ))}
        </div>

        <ul>
          {filtered.map(s => {
            const realIdx = radioStations.indexOf(s);
            const isCur   = realIdx === rIdx;
            return (
              <li key={s.id}>
                <button aria-current={isCur}
                  onClick={() => { setRIdx(realIdx); playStation(realIdx); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <span className="num">{s.frequency.split(' ')[0]}</span>
                  <div className="guide-logo-box">
                    <img src={s.logo} alt="" className="guide-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <span>
                    <span className="nm">{s.name}</span>
                    <span className="in">{s.genre} · {s.region}</span>
                  </span>
                  <span className="live">{isCur ? (rPlaying && rStatus === 'On air' ? '● On Air' : '●') : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP — Tab navigation
// ═══════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [tab, setTab] = useState('tv');
  const audioRef = useRef(null);

  return (
    <>
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />

      <main>
        {/* ── Tab switcher ── */}
        <div className="tab-nav">
          <button
            className={`tab-btn${tab === 'tv' ? ' active' : ''}`}
            onClick={() => setTab('tv')}
            aria-current={tab === 'tv'}
          >
            📺 Live TV
          </button>
          <button
            className={`tab-btn${tab === 'radio' ? ' active' : ''}`}
            onClick={() => setTab('radio')}
            aria-current={tab === 'radio'}
          >
            📻 Radio
          </button>
        </div>

        {tab === 'tv'    && <RetroTV    audioRef={audioRef} />}
        {tab === 'radio' && <VintageRadio audioRef={audioRef} />}
      </main>
    </>
  );
}
