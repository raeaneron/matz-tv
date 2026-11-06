export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Route: Live YouTube ID resolver
  if (path.includes('/live-id')) {
    const handle = url.searchParams.get('channel');
    if (!handle) {
      return new Response(JSON.stringify({ error: 'Channel handle required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
      let videoId = null;

      // 1. Check PinasDex for verified live stream IDs
      try {
        const pinasRes = await fetch('https://pinasdex.com/live-tv/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (pinasRes.ok) {
          const pinasHtml = await pinasRes.text();
          const matchRows = pinasHtml.match(/<script id="lt-rows" type="application\/json">(.*?)<\/script>/);
          if (matchRows) {
            const rows = JSON.parse(matchRows[1]);
            const handleLower = cleanHandle.toLowerCase();
            let matchedRow = null;
            if (handleLower.includes('gmanetwork')) {
              matchedRow = rows.find(r => r.slug === 'kapuso-stream' || r.name?.toLowerCase().includes('kapuso'));
            } else if (handleLower.includes('gmanews')) {
              matchedRow = rows.find(r => r.slug === 'gma-news' || r.name?.toLowerCase().includes('gma news'));
            } else if (handleLower.includes('abscbnentertainment')) {
              matchedRow = rows.find(r => r.slug === 'kapamilya-online-live' || r.name?.toLowerCase().includes('kapamilya'));
            } else if (handleLower.includes('untv')) {
              matchedRow = rows.find(r => r.slug === 'untv' || r.name?.toLowerCase().includes('untv'));
            } else if (handleLower.includes('dzrh')) {
              matchedRow = rows.find(r => r.slug === 'dzrh-tv' || r.name?.toLowerCase().includes('dzrh'));
            } else if (handleLower.includes('tv5')) {
              matchedRow = rows.find(r => r.slug === 'tv5-kapatid' || r.name?.toLowerCase().includes('tv5'));
            } else if (handleLower.includes('net25')) {
              matchedRow = rows.find(r => r.slug === 'net25' || r.name?.toLowerCase().includes('net25'));
            }
            if (matchedRow && matchedRow.id) {
              videoId = matchedRow.id;
            }
          }
        }
      } catch (errPinas) {
        console.warn('Pinasdex resolver fallback:', errPinas.message);
      }

      // 2. Fallback to direct YouTube channel scrape
      if (!videoId) {
        const res = await fetch(`https://www.youtube.com/${cleanHandle}/live`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          redirect: 'follow'
        });
        const html = await res.text();
        const match1 = html.match(/canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
        if (match1) {
          videoId = match1[1];
        }
      }

      return new Response(JSON.stringify({ handle: cleanHandle, videoId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Route: Proxy
  if (path.includes('/proxy')) {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('URL parameter required', { status: 400, headers: corsHeaders });

    try {
      const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      };

      const response = await fetch(targetUrl, { headers: fetchHeaders });
      if (!response.ok) {
        return new Response(`Upstream error: ${response.status}`, { status: response.status, headers: corsHeaders });
      }

      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (targetUrl.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
      else if (targetUrl.includes('.ts')) contentType = 'video/MP2T';
      else if (targetUrl.includes('.mpd')) contentType = 'application/dash+xml';
      else if (targetUrl.includes('.mp3')) contentType = 'audio/mpeg';
      else if (targetUrl.includes('.aac')) contentType = 'audio/aac';

      const responseHeaders = { ...corsHeaders, 'Content-Type': contentType };

      if (targetUrl.includes('.m3u8')) {
        let text = await response.text();
        const cleanTarget = targetUrl.split('?')[0];
        const baseUrl = cleanTarget.substring(0, cleanTarget.lastIndexOf('/') + 1);
        const host = url.host;
        const proto = url.protocol;

        text = text.split('\n').map(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
            return `${proto}//${host}/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
          }
          if (line.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/, (match, p1) => {
              const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
              return `URI="${proto}//${host}/api/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
            });
          }
          return line;
        }).join('\n');

        return new Response(text, { headers: responseHeaders });
      }

      const blob = await response.blob();
      return new Response(blob, { headers: responseHeaders });
    } catch (err) {
      return new Response(`Proxy fetch failed: ${err.message}`, { status: 502, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ status: 'ok', service: 'matz-tv-api' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
