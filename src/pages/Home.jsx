import { useState, useEffect } from 'react';
import Player from '../components/Player';
import { Search, Play, X, Loader2 } from 'lucide-react';
import { iptvService } from '../services/iptv';

export default function Home() {
  const [channels, setChannels] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [activeSource, setActiveSource] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch channels directly from the IPTV API (client-side)
    iptvService.fetchChannels()
      .then(data => {
        setChannels(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error loading channels", err);
        setError(err.message || "Failed to load channels. Please check your connection.");
        setIsLoading(false);
      });
  }, []);

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleChannelClick = (channel) => {
    if (channel.sources.length === 1) {
      handleSourceSelect(channel, channel.sources[0]);
    } else {
      setSelectedChannel(channel);
      setActiveSource(null); // Open modal
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSourceSelect = async (channel, source) => {
    setSelectedChannel(channel);
    setIsFetchingSource(true);
    try {
      const streamInfo = await iptvService.fetchStream(channel.name, source.index);
      setActiveSource({ name: source.name, url: streamInfo.url, type: streamInfo.type });
    } catch(err) {
      console.error("Error fetching stream url", err);
      alert("Failed to load stream. Please try another server.");
    } finally {
      setIsFetchingSource(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-10">
      {/* Sticky Glassmorphism Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/70 backdrop-blur-xl border-b border-white/5 py-4 px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Play className="text-white fill-white w-5 h-5 ml-1" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            MATZ TV
          </h1>
        </div>
        
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Search channels or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/80 border border-white/10 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition outline-none"
          />
        </div>
      </header>

      <main className="px-6 mt-6 max-w-7xl mx-auto">
        {/* Inline Player Loading State */}
        {isFetchingSource && (
          <div className="relative w-full max-w-4xl mx-auto mb-8 bg-[#111] rounded-2xl aspect-video flex flex-col items-center justify-center shadow-2xl ring-1 ring-white/10 mt-6 animate-pulse">
             <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
             <p className="text-zinc-400 font-medium">Securing connection...</p>
          </div>
        )}

        {/* Inline Player */}
        {!isFetchingSource && activeSource && selectedChannel && (
          <Player 
            source={activeSource} 
            channelName={selectedChannel.name} 
            onClose={() => { setActiveSource(null); setSelectedChannel(null); }} 
          />
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center py-32 text-center px-4">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
               <X size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-zinc-400 mb-6 max-w-md">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-xl transition font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
            <p className="text-zinc-400">Loading IPTV Channels...</p>
          </div>
        ) : (
          <>
            {/* Channels Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {filteredChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelClick(channel)}
                  className="group relative bg-[#111] rounded-2xl p-3 border border-white/5 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all duration-300 text-left flex flex-col hover:-translate-y-1"
                >
                  <div className="w-full aspect-video bg-black rounded-xl mb-3 overflow-hidden flex items-center justify-center relative p-2">
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      loading="lazy"
                      className="object-contain w-full h-full opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <div className="w-12 h-12 rounded-full bg-red-500/90 flex items-center justify-center text-white shadow-lg">
                        <Play className="fill-white w-6 h-6 ml-1" />
                      </div>
                    </div>
                  </div>

                  <div className="w-full px-1">
                    <h2 className="font-semibold text-sm truncate text-zinc-100">
                      {channel.name}
                    </h2>
                    <p className="text-xs text-red-400 mt-1 font-medium truncate">
                      {channel.category}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            
            {filteredChannels.length === 0 && (
              <div className="text-center py-20 text-zinc-500 flex flex-col items-center">
                <Search size={48} className="mb-4 opacity-20" />
                <p className="text-lg">No channels found for "{search}"</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Source Selection Modal */}
      {selectedChannel && !activeSource && !isFetchingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-scale-up">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]">
              <h3 className="font-bold text-lg text-white">Select Stream Source</h3>
              <button onClick={() => setSelectedChannel(null)} className="text-zinc-400 hover:text-white transition bg-white/5 p-1.5 rounded-full hover:bg-red-500/20 hover:text-red-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-3">
              {selectedChannel.sources.map((source, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSourceSelect(selectedChannel, source)}
                  className="w-full text-left p-4 hover:bg-zinc-800/80 rounded-xl transition flex items-center justify-between mb-2 group border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition shadow-sm">
                      <Play size={16} className="fill-current ml-0.5" />
                    </div>
                    <span className="font-medium text-zinc-200 group-hover:text-white transition">{source.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 bg-zinc-900 px-2 py-1 rounded-md group-hover:bg-zinc-700 transition">
                    PLAY
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
