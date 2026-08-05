export const channels = [
  // ── NEWS ──────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Al Jazeera English",
    category: "NEWS",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_Logo.svg/320px-Al_Jazeera_English_Logo.svg.png",
    sources: [
      { name: "Live HD", index: 0, url: "https://live-hls-web-aje.getaj.net/AJE/01.m3u8" }
    ]
  },
  {
    id: 2,
    name: "Bloomberg TV",
    category: "NEWS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bloomberg_Television_logo.svg/320px-Bloomberg_Television_logo.svg.png",
    sources: [
      { name: "Live", index: 0, url: "https://cdn3.wowza.com/1/ejZvcEdIMVE2M1Ri/cHVs/hls/live/playlist.m3u8" }
    ]
  },
  {
    id: 3,
    name: "NASA TV",
    category: "NEWS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/320px-NASA_logo.svg.png",
    sources: [
      { name: "Public Channel", index: 0, url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8" }
    ]
  },
  // ── ENTERTAINMENT ─────────────────────────────────────────────────────────
  {
    id: 4,
    name: "Euronews",
    category: "ENTERTAINMENT",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Euronews_logo_%28transparent%29.svg/320px-Euronews_logo_%28transparent%29.svg.png",
    sources: [
      { name: "English HD", index: 0, url: "https://rakuten-euronews-1-gb.samsung.wurl.tv/manifest/playlist.m3u8" }
    ]
  },
  {
    id: 5,
    name: "DW English",
    category: "ENTERTAINMENT",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png",
    sources: [
      { name: "Live Stream", index: 0, url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/stream09/streamPlaylist.m3u8" }
    ]
  },
  {
    id: 6,
    name: "France 24 English",
    category: "NEWS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/France_24_logo.svg/320px-France_24_logo.svg.png",
    sources: [
      { name: "Live HD", index: 0, url: "https://stream.france24.com/hls/live/2037218/F24_EN_HI_HLS/master.m3u8" }
    ]
  },
  // ── MUSIC ─────────────────────────────────────────────────────────────────
  {
    id: 7,
    name: "Music Box",
    category: "MUSIC",
    logo: "https://placehold.co/300x170/1a1a2e/e94560?text=🎵+MUSIC",
    sources: [
      { name: "Server 1", index: 0, url: "https://cdnlive.shooowit.net/ltlive/smil:lt.smil/playlist.m3u8" }
    ]
  },
  {
    id: 8,
    name: "Mezzo Live HD",
    category: "MUSIC",
    logo: "https://placehold.co/300x170/0f3460/e94560?text=MEZZO",
    sources: [
      { name: "Live", index: 0, url: "https://mezzo-live-hd.ssl.cdn.snt.net.pl/out/v1/6e6566b3c17d4b06ba1b8b9a2a089979/index.m3u8" }
    ]
  },
  // ── SPORTS ────────────────────────────────────────────────────────────────
  {
    id: 9,
    name: "Eurosport 1",
    category: "SPORTS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Eurosport_1_logo.svg/320px-Eurosport_1_logo.svg.png",
    sources: [
      { name: "Stream 1", index: 0, url: "https://rakuten-eurosport-1-1-it.samsung.wurl.tv/manifest/playlist.m3u8" }
    ]
  },
  {
    id: 10,
    name: "Sport TV",
    category: "SPORTS",
    logo: "https://placehold.co/300x170/1b1b2f/e43f5a?text=SPORT+TV",
    sources: [
      { name: "Main", index: 0, url: "https://str34.creacast.com/splashtv2/high/playlist.m3u8" }
    ]
  },
  // ── KIDS ──────────────────────────────────────────────────────────────────
  {
    id: 11,
    name: "Cartoon Network",
    category: "KIDS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/320px-Cartoon_Network_2010_logo.svg.png",
    sources: [
      { name: "Stream", index: 0, url: "https://ott.jindujun.cn/live/dbjtoon/index.m3u8" }
    ]
  },
  {
    id: 12,
    name: "Baby TV",
    category: "KIDS",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Baby_TV_logo.svg/320px-Baby_TV_logo.svg.png",
    sources: [
      { name: "Live", index: 0, url: "https://rakuten-baby-tv-1-de.samsung.wurl.tv/manifest/playlist.m3u8" }
    ]
  },
  // ── DOCUMENTARY ───────────────────────────────────────────────────────────
  {
    id: 13,
    name: "RT Documentary",
    category: "DOCUMENTARY",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/RT_logo.svg/320px-RT_logo.svg.png",
    sources: [
      { name: "Live HD", index: 0, url: "https://rt-docu.rttv.com/live/rtdoc/index.m3u8" }
    ]
  },
  {
    id: 14,
    name: "Curiosity Stream",
    category: "DOCUMENTARY",
    logo: "https://placehold.co/300x170/1c1c2e/a855f7?text=CURIOSITY",
    sources: [
      { name: "Stream", index: 0, url: "https://csmdtv.akamaized.net/hls/live/2002830/cs_live/master.m3u8" }
    ]
  },
  // ── MOVIES ────────────────────────────────────────────────────────────────
  {
    id: 15,
    name: "Pluto TV Movies",
    category: "MOVIES",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Pluto_TV_logo.svg/320px-Pluto_TV_logo.svg.png",
    sources: [
      { name: "Server 1", index: 0, url: "https://service-stitcher.clusters.pluto.tv/v1/stitch/hls/channel/5f30bf3e4c9e2a0007699e70/master.m3u8?deviceId=matztv&deviceType=web&deviceMake=Chrome&deviceModel=web&appName=web&appVersion=na&deviceDNT=0&advertisingId=&userId=&sessionID=matztv&serverSideAds=false&embedPartner=&signature=&jwt=" }
    ]
  },
  {
    id: 16,
    name: "Action Movies 24/7",
    category: "MOVIES",
    logo: "https://placehold.co/300x170/1a0a0a/ff4444?text=🎬+ACTION",
    sources: [
      { name: "Live", index: 0, url: "https://rakuten-action-movies-1-it.samsung.wurl.tv/manifest/playlist.m3u8" }
    ]
  },
  // ── LIFESTYLE ─────────────────────────────────────────────────────────────
  {
    id: 17,
    name: "Food Network",
    category: "LIFESTYLE",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Food_Network_new_logo.svg/320px-Food_Network_new_logo.svg.png",
    sources: [
      { name: "Stream", index: 0, url: "https://rakuten-food-network-1-us.samsung.wurl.tv/manifest/playlist.m3u8" }
    ]
  },
  {
    id: 18,
    name: "Travel Channel",
    category: "LIFESTYLE",
    logo: "https://placehold.co/300x170/0d2137/00b4d8?text=✈️+TRAVEL",
    sources: [
      { name: "Live", index: 0, url: "https://rakuten-travel-channel-1-us.samsung.wurl.tv/manifest/playlist.m3u8" }
    ]
  },
  // ── TECH ──────────────────────────────────────────────────────────────────
  {
    id: 19,
    name: "Lofi Radio",
    category: "MUSIC",
    logo: "https://placehold.co/300x170/1a1a2e/9d4edd?text=🎧+LOFI",
    sources: [
      { name: "24/7 Stream", index: 0, url: "https://strn.isolution.studio/radio/8000/stream?1733065481" }
    ]
  },
  {
    id: 20,
    name: "Test Stream (HLS)",
    category: "ENTERTAINMENT",
    logo: "https://placehold.co/300x170/111111/ffffff?text=▶+TEST",
    sources: [
      { name: "Mux Test HD", index: 0, url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
      { name: "Mux Test SD", index: 1, url: "https://test-streams.mux.dev/test_001/stream.m3u8" }
    ]
  }
]
