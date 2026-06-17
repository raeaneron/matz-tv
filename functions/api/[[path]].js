const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Origin': 'https://iyadtv.pages.dev',
  'Referer': 'https://iyadtv.pages.dev/'
};

async function decryptIyadData(encryptedData, keyString) {
  const binaryString = atob(encryptedData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const iv = bytes.slice(0, 16);
  const ciphertext = bytes.slice(16);
  const keyBytes = new TextEncoder().encode(keyString.substring(0, 16));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const decryptedBytes = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decryptedBytes));
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const tokenRes = await fetch('https://api.iyad.space/token', { headers: HEADERS });
    const tokenData = await tokenRes.json();
    const token = tokenData.token;

    const keyRes = await fetch('https://api.iyad.space/key', {
      headers: { ...HEADERS, 'Authorization': `Bearer ${token}` }
    });
    const keyData = await keyRes.json();
    const key = keyData.key;

    // Route: Channels
    if (path.endsWith('/channels')) {
      const dataRes = await fetch('https://api.iyad.space/data', {
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}` }
      });
      const dataJson = await dataRes.json();
      const channels = await decryptIyadData(dataJson.data, key);
      
      const formatted = channels.filter(c => {
        if (c.enabled !== false) return true;
        const name = (c.name || '').toLowerCase();
        return name.includes('gma') || name.includes('kapamilya');
      }).map((c, index) => {
        const sources = [
          { name: c.alt_name || "Server 1", index: 0 },
          { name: c.alt_name2 || "Server 2", index: 1 },
          { name: c.alt_name3 || "Server 3", index: 2 }
        ];
        for (let i = 4; i <= 10; i++) {
          if (c[`alt_name${i}`]) sources.push({ name: c[`alt_name${i}`], index: i - 1 });
        }
        return {
          id: index + 1,
          name: c.name,
          category: c.tags && c.tags.length > 0 ? c.tags[0].toUpperCase() : 'LIVE TV',
          logo: c.logo || "https://placehold.co/300x170/222222/ffffff?text=" + encodeURIComponent(c.name),
          sources
        };
      });
      return new Response(JSON.stringify(formatted), { headers: corsHeaders });
    }

    // Route: Stream
    if (path.endsWith('/stream') && method === 'POST') {
      const body = await request.json();
      const { channelName, serverIndex } = body;
      const playRes = await fetch('https://api.iyad.space/play', {
        method: 'POST',
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, serverIndex: serverIndex || 0 })
      });
      const playData = await playRes.json();
      const streamInfo = await decryptIyadData(playData.data, key);
      return new Response(JSON.stringify(streamInfo), { headers: corsHeaders });
    }

    // Route: Proxy
    if (path.includes('/proxy')) {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return new Response('URL required', { status: 400, headers: corsHeaders });

      const response = await fetch(targetUrl, { headers: HEADERS });
      if (!response.ok) {
        return new Response('Proxy fetch failed', { status: response.status, headers: corsHeaders });
      }

      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (targetUrl.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
      else if (targetUrl.includes('.ts')) contentType = 'video/MP2T';
      else if (targetUrl.includes('.mpd')) contentType = 'application/dash+xml';

      const responseHeaders = { ...corsHeaders, 'Content-Type': contentType };

      if (targetUrl.includes('.m3u8') || targetUrl.includes('.mpd')) {
        let text = await response.text();
        const finalUrl = response.url.split('?')[0];
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const host = url.host;
        const protocol = url.protocol;
        
        if (targetUrl.includes('.m3u8')) {
          text = text.split('\n').map(line => {
            if (line.trim() && !line.startsWith('#')) {
              const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
              if (absoluteUrl.includes('.ts')) {
                return absoluteUrl;
              }
              const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
              return `${protocol}//${host}/api/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}`;
            }
            if (line.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/, (match, p1) => {
                 const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                 if (absoluteUrl.includes('.ts')) return `URI="${absoluteUrl}"`;
                 const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
                 return `URI="${protocol}//${host}/api/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}"`;
              });
            }
            return line;
          }).join('\n');
        }
        
        return new Response(text, { headers: responseHeaders });
      } else {
        const blob = await response.blob();
        return new Response(blob, { headers: responseHeaders });
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), { status: 500, headers: corsHeaders });
  }
}
