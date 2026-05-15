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
  const [viewMode, setViewMode] = useState('list'); // Default to list for better performance on old devices

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
    window.scrollTo(0, 0);
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
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-10">
      {/* Sticky Header - Simplified for old browsers */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5 py-3 px-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg">
              <Play className="text-white fill-white w-4 h-4 ml-0.5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">MATZ TV</h1>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-zinc-900 rounded-lg p-1 scale-90 sm:scale-100">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md transition-all text-xs font-bold ${viewMode === 'grid' ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}
            >
              GRID
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md transition-all text-xs font-bold ${viewMode === 'list' ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}
            >
              LIST
            </button>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-zinc-500" />
          </div>
          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-zinc-900 border border-white/5 focus:border-red-500/50 outline-none text-sm"
          />
        </div>
      </header>

      <main className="px-4 mt-4 max-w-7xl mx-auto">
        {/* Inline Player Loading State */}
        {isFetchingSource && (
          <div className="relative w-full max-w-4xl mx-auto mb-6 bg-[#111] rounded-xl aspect-video flex flex-col items-center justify-center ring-1 ring-white/10 mt-2">
             <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
             <p className="text-zinc-500 text-xs font-medium">Connecting to stream...</p>
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
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
               <X size={24} />
            </div>
            <h2 className="text-lg font-bold mb-1">Load Failed</h2>
            <p className="text-zinc-500 text-xs mb-4 max-w-xs">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm font-bold"
            >
              RETRY
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
            <p className="text-zinc-500 text-xs">Loading Channels...</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              /* Much Smaller Grid View */
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                {filteredChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelClick(channel)}
                    className="group relative bg-[#111] rounded-lg p-1 border border-white/5 hover:border-red-500/30 transition-all text-left flex flex-col active:scale-95"
                  >
                    <div className="w-full aspect-square bg-black rounded-md mb-1.5 overflow-hidden flex items-center justify-center relative p-1">
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        loading="lazy"
                        className="object-contain w-full h-full opacity-80"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="fill-white w-3 h-3" />
                      </div>
                    </div>
                    <div className="w-full px-0.5 overflow-hidden">
                      <h2 className="font-bold text-[8px] sm:text-[10px] truncate text-zinc-100 leading-tight">
                        {channel.name}
                      </h2>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* List View - Best for old iPad - Removed 'gap' for iOS 10 compatibility */
              <div className="flex flex-col max-w-4xl mx-auto">
                {filteredChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelClick(channel)}
                    className="flex items-center bg-[#111] hover:bg-[#1a1a1a] p-2 rounded-lg border border-white/5 transition active:bg-red-500/10 group mb-1.5"
                  >
                    <div className="w-10 h-7 bg-black rounded overflow-hidden flex items-center justify-center p-1 flex-shrink-0 mr-3">
                      <img src={channel.logo} alt="" className="object-contain w-full h-full" />
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                      <h3 className="font-bold text-xs sm:text-sm text-zinc-100 truncate group-hover:text-red-400 transition">{channel.name}</h3>
                      <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">{channel.category}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-red-500 group-hover:text-white transition ml-3">
                       <Play size={10} className="fill-current ml-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {filteredChannels.length === 0 && (
              <div className="text-center py-20 text-zinc-600 flex flex-col items-center">
                <Search size={32} className="mb-4 opacity-10" />
                <p className="text-sm">No channels found</p>
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
