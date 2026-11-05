import { useState, useEffect, useRef } from 'react';
import { Tv, Radio, Search, Play, Pause, X, Loader2, ChevronRight, Volume2, Wifi, LayoutGrid, List } from 'lucide-react';
import Player from '../components/Player';
import { channels as channelList } from '../data/channels';
import { radioStations } from '../data/radio';
import Hls from 'hls.js';

const TV_CATEGORIES = ['ALL', 'PH LOCAL', 'NEWS', 'SPORTS', 'KIDS', 'INTERNATIONAL'];
const RADIO_REGIONS = ['ALL', 'Metro Manila', 'Luzon', 'Visayas', 'Mindanao', 'International'];

// --- TV Section (PinasDex-style Live TV) ---
function TVSection() {
  const [channels] = useState(channelList);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [selectedChannel, setSelectedChannel] = useState(channels[0] || null); // Auto-load first channel like PinasDex
  const [viewMode, setViewMode] = useState('list'); // Default list for PinasDex TV guide look

  const filtered = channels.filter(c => {
    const matchCat = category === 'ALL' || c.category === category;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.title && c.title.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const currentIndex = channels.findIndex(c => c.id === selectedChannel?.id);

  const handleNext = () => {
    if (channels.length === 0) return;
    const nextIdx = (currentIndex + 1) % channels.length;
    setSelectedChannel(channels[nextIdx]);
  };

  const handlePrev = () => {
    if (channels.length === 0) return;
    const prevIdx = (currentIndex - 1 + channels.length) % channels.length;
    setSelectedChannel(channels[prevIdx]);
  };

  const handleChannelClick = (channel) => {
    setSelectedChannel(channel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Prominent Screen Player (PinasDex style) */}
      {selectedChannel && (
        <Player
          channel={selectedChannel}
          onClose={() => setSelectedChannel(null)}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}

      {/* Guide Header & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 mt-2">
        {/* Category Pills */}
        <div className="flex gap-1.5 flex-wrap">
          {TV_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition border ${
                category === cat
                  ? 'bg-red-600 border-red-500 text-white shadow-md'
                  : 'bg-[#111] border-white/5 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#111] border border-white/5 rounded-lg text-xs outline-none focus:border-red-500/50 placeholder:text-zinc-600"
            />
          </div>

          <div className="flex bg-[#111] border border-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
              title="Guide List View"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
              title="Card Grid View"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* PinasDex-style Channel Guide List */}
      {viewMode === 'list' ? (
        <div className="flex flex-col gap-1.5 max-w-4xl">
          {filtered.map(channel => {
            const isCur = selectedChannel?.id === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all active:scale-[0.99] group ${
                  isCur
                    ? 'bg-red-600/15 border-red-500/60 shadow-lg ring-1 ring-red-500/30'
                    : 'bg-[#111] border-white/5 hover:bg-[#181818] hover:border-white/15'
                }`}
              >
                {/* Channel Number */}
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 transition ${
                    isCur
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-800/80 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'
                  }`}
                >
                  {channel.ch}
                </span>

                {/* Logo */}
                <div className="w-10 h-7 bg-black rounded overflow-hidden flex items-center justify-center p-0.5 flex-shrink-0 border border-white/5">
                  <img src={channel.logo} alt="" className="w-full h-full object-contain" />
                </div>

                {/* Info */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-black truncate ${isCur ? 'text-red-400' : 'text-zinc-100 group-hover:text-white'}`}>
                      {channel.name}
                    </p>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase px-1.5 py-0.2 bg-zinc-900 rounded">
                      {channel.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {channel.title || 'Live Broadcast Stream'}
                  </p>
                </div>

                {/* Live Indicator */}
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-[9px] font-black text-zinc-400 tracking-widest hidden sm:inline">LIVE</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {filtered.map(channel => {
            const isCur = selectedChannel?.id === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                className={`group relative bg-[#111] hover:bg-[#1a1a1a] border rounded-xl overflow-hidden transition-all active:scale-95 text-left flex flex-col ${
                  isCur
                    ? 'border-red-500/60 ring-1 ring-red-500/40 bg-red-600/10'
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
                    <span className="text-[8px] font-black text-red-500">CH {channel.ch}</span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold text-zinc-100 truncate leading-tight">{channel.name}</p>
                  <p className="text-[9px] text-zinc-500 truncate mt-0.5">{channel.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
  const [playing, setPlaying] = useState(null);
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

    let streamUrl = station.url;
    if (streamUrl.startsWith('http://')) {
      streamUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
    }

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
          if (data.fatal) setPlaying({ station, state: 'error' });
        });
        return;
      }
    }

    audio.src = streamUrl;
    audio.play()
      .then(() => setPlaying({ station, state: 'playing' }))
      .catch(() => {
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
    return () => stopRadio();
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

      {/* Region Filters */}
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

// --- Main App Shell ---
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
              tab === 'tv' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv size={15} /> Live TV
          </button>
          <button
            onClick={() => setTab('radio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === 'radio' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={15} /> Radio
          </button>
        </nav>

        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
          <Wifi size={12} className="text-green-500" />
          <span>Free Broadcasts</span>
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
            <p className="text-[10px] font-bold text-red-400 mb-1">📺 PinasDex Guide</p>
            <p className="text-[9px] text-zinc-500 leading-relaxed">
              Flip through Philippine TV channels and live radio stations without subscriptions.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
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
