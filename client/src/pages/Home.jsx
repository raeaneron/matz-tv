import { useState, useEffect, useRef } from 'react';
import { Tv, Radio, Search, Play, Pause, X, Loader2, ChevronRight, Volume2, Wifi } from 'lucide-react';
import Player from '../components/Player';
import { iptvService } from '../services/iptv';
import { radioStations } from '../data/radio';
import Hls from 'hls.js';

const TV_CATEGORIES = ['ALL', 'PH LOCAL', 'NEWS', 'SPORTS', 'KIDS', 'INTERNATIONAL'];
const RADIO_REGIONS = ['ALL', 'Metro Manila', 'Luzon', 'Visayas', 'Mindanao', 'International'];

// --- TV Section ---
function TVSection() {
  const [channels, setChannels] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [activeSource, setActiveSource] = useState(null);
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [streamError, setStreamError] = useState(null);

  useEffect(() => {
    iptvService.fetchChannels().then(setChannels);
  }, []);

  const filtered = channels.filter(c => {
    const matchCat = category === 'ALL' || c.category === category;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handlePlay = async (channel, source) => {
    setSelectedChannel(channel);
    setIsFetchingSource(true);
    setStreamError(null);
    setActiveSource(null);
    if (!window.globalTriedSources) window.globalTriedSources = new Set();
    window.globalTriedSources.add(source.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const info = await iptvService.fetchStream(channel.name, source.index);
      setActiveSource({ name: source.name, url: info.url, type: info.type });
    } catch (e) {
      setStreamError('Stream unavailable. Try another channel or server.');
    } finally {
      setIsFetchingSource(false);
    }
  };

  const handleChannelClick = (channel) => {
    if (window.globalTriedSources) window.globalTriedSources.clear();
    handlePlay(channel, channel.sources[0]);
  };

  const handleClose = () => {
    setActiveSource(null);
    setSelectedChannel(null);
    setStreamError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Player Area */}
      {(isFetchingSource || activeSource || streamError) && (
        <div className="w-full bg-black mb-4 rounded-xl overflow-hidden border border-white/5">
          {isFetchingSource && (
            <div className="aspect-video flex flex-col items-center justify-center bg-[#0d0d0d]">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
              <p className="text-zinc-500 text-xs">Connecting to stream...</p>
            </div>
          )}
          {!isFetchingSource && streamError && (
            <div className="aspect-video flex flex-col items-center justify-center bg-[#0d0d0d] p-4 text-center">
              <X className="w-8 h-8 text-red-500 mb-2" />
              <p className="text-zinc-400 text-sm mb-3">{streamError}</p>
              <button onClick={handleClose} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition">
                CLOSE
              </button>
            </div>
          )}
          {!isFetchingSource && activeSource && selectedChannel && (
            <div>
              <Player
                source={activeSource}
                channelName={selectedChannel.name}
                onClose={handleClose}
                availableSources={selectedChannel.sources}
                onSwitchSource={(s) => handlePlay(selectedChannel, s)}
              />
              {selectedChannel.sources.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#0d0d0d] border-t border-white/5">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Servers:</span>
                  {selectedChannel.sources.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handlePlay(selectedChannel, s)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold border transition ${
                        activeSource.name === s.name
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-700'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search + Category Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-[#111] border border-white/5 rounded-lg text-sm outline-none focus:border-red-500/50 placeholder:text-zinc-600"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {TV_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition border ${
                category === cat
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-[#111] border-white/5 text-zinc-500 hover:text-white hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
        {filtered.map(channel => (
          <button
            key={channel.id}
            onClick={() => handleChannelClick(channel)}
            className={`group relative bg-[#111] hover:bg-[#1a1a1a] border rounded-xl overflow-hidden transition-all active:scale-95 text-left flex flex-col ${
              selectedChannel?.id === channel.id
                ? 'border-red-500/60 ring-1 ring-red-500/40'
                : 'border-white/5 hover:border-white/20'
            }`}
          >
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              <img
                src={channel.logo}
                alt={channel.name}
                loading="lazy"
                className="w-full h-full object-cover opacity-75 group-hover:opacity-95 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                  <Play size={12} className="fill-white text-white ml-0.5" />
                </div>
              </div>
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/75 rounded px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[8px] font-bold text-white tracking-widest">LIVE</span>
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-zinc-100 truncate leading-tight">{channel.name}</p>
              <p className="text-[9px] text-zinc-600 font-medium uppercase tracking-wider mt-0.5">{channel.category}</p>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
          <Tv size={36} className="mb-3 opacity-20" />
          <p className="text-sm">No channels found</p>
        </div>
      )}
    </div>
  );
}

// --- Radio Section ---
function RadioSection() {
  const [region, setRegion] = useState('ALL');
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(null); // { station, state: 'loading'|'playing'|'error' }
  const audioRef = useRef(null);
  const hlsRef = useRef(null);

  const filtered = radioStations.filter(s => {
    const matchRegion = region === 'ALL' || s.region === region;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.genre.toLowerCase().includes(search.toLowerCase());
    return matchRegion && matchSearch;
  });

  const stopRadio = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setPlaying(null);
  };

  const playStation = (station) => {
    if (playing?.station?.id === station.id && playing.state === 'playing') {
      stopRadio();
      return;
    }

    stopRadio();
    setPlaying({ station, state: 'loading' });

    const audio = audioRef.current;
    if (!audio) return;

    // Resolve URL (proxy http:// streams to avoid mixed-content blocks)
    let streamUrl = station.url;
    if (streamUrl.startsWith('http://')) {
      streamUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
    }

    // Check if stream is HLS audio (.m3u8)
    if (station.url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(audio);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play()
            .then(() => setPlaying({ station, state: 'playing' }))
            .catch(() => setPlaying({ station, state: 'error' }));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            setPlaying({ station, state: 'error' });
          }
        });
        return;
      }
    }

    // Standard audio (MP3 / AAC)
    audio.src = streamUrl;
    audio.play()
      .then(() => {
        setPlaying({ station, state: 'playing' });
      })
      .catch((err) => {
        console.error("Audio playback error:", err);
        // Fallback: try proxying through server
        if (!streamUrl.includes('/api/proxy')) {
          const proxied = `/api/proxy?url=${encodeURIComponent(station.url)}`;
          audio.src = proxied;
          audio.play()
            .then(() => setPlaying({ station, state: 'playing' }))
            .catch(() => setPlaying({ station, state: 'error' }));
        } else {
          setPlaying({ station, state: 'error' });
        }
      });
  };

  useEffect(() => {
    return () => {
      stopRadio();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <audio
        ref={audioRef}
        onEnded={stopRadio}
        onError={() => setPlaying(p => p ? { ...p, state: 'error' } : null)}
        crossOrigin="anonymous"
      />

      {/* Now Playing Bar */}
      {playing && (
        <div className={`mb-4 rounded-xl border p-4 flex items-center gap-4 transition-all ${
          playing.state === 'error' ? 'bg-red-900/20 border-red-500/30' : 'bg-[#111] border-red-500/30 shadow-lg'
        }`}>
          <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0 relative">
            {playing.state === 'loading' ? (
              <Loader2 size={20} className="text-red-500 animate-spin" />
            ) : playing.state === 'error' ? (
              <X size={20} className="text-red-400" />
            ) : (
              <Volume2 size={20} className="text-red-400" />
            )}
            {playing.state === 'playing' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-black"></span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-zinc-100 truncate">{playing.station.name}</p>
            <p className="text-[10px] text-zinc-500">{playing.station.frequency} · {playing.station.genre}</p>
            {playing.state === 'error' && <p className="text-[10px] text-red-400 mt-0.5">Stream offline or unavailable</p>}
            {playing.state === 'loading' && <p className="text-[10px] text-zinc-500 mt-0.5 animate-pulse">Connecting to broadcast...</p>}
            {playing.state === 'playing' && <p className="text-[10px] text-green-400 mt-0.5 font-bold">● ON AIR</p>}
          </div>
          <button
            onClick={stopRadio}
            className="p-2 rounded-full bg-white/5 hover:bg-red-600 text-zinc-400 hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search stations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-[#111] border border-white/5 rounded-lg text-sm outline-none focus:border-red-500/50 placeholder:text-zinc-600"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {RADIO_REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition border ${
                region === r
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-[#111] border-white/5 text-zinc-500 hover:text-white hover:border-white/20'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Station List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(station => {
          const isActive = playing?.station?.id === station.id;
          const isPlaying = isActive && playing.state === 'playing';
          const isLoading = isActive && playing.state === 'loading';
          const isError = isActive && playing.state === 'error';

          return (
            <button
              key={station.id}
              onClick={() => playStation(station)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-95 text-left group ${
                isActive
                  ? 'bg-red-600/10 border-red-500/40 shadow-sm'
                  : 'bg-[#111] border-white/5 hover:bg-[#1a1a1a] hover:border-white/15'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs transition ${
                  isActive ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'
                }`}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : isPlaying ? (
                  <Pause size={16} className="text-white fill-white" />
                ) : isError ? (
                  <X size={16} className="text-white" />
                ) : (
                  <Play size={16} className={`ml-0.5 ${isActive ? 'text-white fill-white' : 'fill-current'}`} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className={`text-sm font-bold truncate leading-tight ${isActive ? 'text-red-400' : 'text-zinc-100'}`}>
                  {station.name}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{station.frequency} · {station.region}</p>
                <p className="text-[10px] text-zinc-600">{station.genre}</p>
              </div>
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-5 mr-1 flex-shrink-0">
                  {[1, 2, 3, 4].map(i => (
                    <span
                      key={i}
                      className="w-1 bg-red-500 rounded-sm animate-pulse"
                      style={{ height: `${[60, 100, 80, 40][i - 1]}%`, animationDelay: `${i * 0.12}s` }}
                    ></span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
          <Radio size={36} className="mb-3 opacity-20" />
          <p className="text-sm">No stations found</p>
        </div>
      )}
    </div>
  );
}

// --- Main App ---
export default function Home() {
  const [tab, setTab] = useState('tv');

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/5 h-14 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg">
            <Play size={14} className="fill-white text-white ml-0.5" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            MATZ<span className="text-red-500">TV</span>
          </span>
        </div>

        <nav className="hidden sm:flex items-center gap-1 ml-4">
          <button
            onClick={() => setTab('tv')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === 'tv' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv size={15} /> Live TV
          </button>
          <button
            onClick={() => setTab('radio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === 'radio' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={15} /> Radio
          </button>
        </nav>

        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
          <Wifi size={12} className="text-green-500" />
          <span>Free Streaming</span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-[#0a0a0a] border-r border-white/5 py-6 px-3 gap-1 flex-shrink-0">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-2 mb-2">Menu</p>
          <SidebarBtn icon={<Tv size={16} />} label="Live TV" active={tab === 'tv'} onClick={() => setTab('tv')} />
          <SidebarBtn icon={<Radio size={16} />} label="Radio" active={tab === 'radio'} onClick={() => setTab('radio')} />

          <div className="mt-6 mx-2 p-3 bg-red-600/10 border border-red-500/20 rounded-xl">
            <p className="text-[10px] font-bold text-red-400 mb-1">📡 Free Broadcasts</p>
            <p className="text-[9px] text-zinc-500 leading-relaxed">
              Philippine & International TV channels + Live Radio streams. No subscription needed.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
            <div>
              <h1 className="text-lg font-black text-white">
                {tab === 'tv' ? 'Live TV Channels' : 'Online Radio'}
              </h1>
              <p className="text-[11px] text-zinc-500">
                {tab === 'tv' ? '31 live TV channels' : '18 live radio stations'}
              </p>
            </div>
          </div>

          {tab === 'tv' ? <TVSection /> : <RadioSection />}
        </main>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/5 flex">
        <button
          onClick={() => setTab('tv')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition ${
            tab === 'tv' ? 'text-red-500' : 'text-zinc-500'
          }`}
        >
          <Tv size={20} />
          <span className="text-[9px] font-bold">LIVE TV</span>
        </button>
        <button
          onClick={() => setTab('radio')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition ${
            tab === 'radio' ? 'text-red-500' : 'text-zinc-500'
          }`}
        >
          <Radio size={20} />
          <span className="text-[9px] font-bold">RADIO</span>
        </button>
      </nav>

      <div className="sm:hidden h-16"></div>
    </div>
  );
}

function SidebarBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
        active
          ? 'bg-red-600/15 text-red-400 border border-red-500/20'
          : 'text-zinc-500 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto text-red-400" />}
    </button>
  );
}
