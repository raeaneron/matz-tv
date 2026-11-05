import { channels } from '../../client/src/data/channels.js';

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
    // Route: Channels — return local channel list
    if (path.endsWith('/channels')) {
      return new Response(JSON.stringify(channels), { headers: corsHeaders });
    }

    // Route: Proxy — forward requests to bypass mixed-content / CORS issues
    if (path.includes('/proxy')) {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return new Response('URL required', { status: 400, headers: corsHeaders });

      const proxyHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://matztv.netlify.app',
        'Referer': 'https://matztv.netlify.app/'
      };

      const response = await fetch(targetUrl, { headers: proxyHeaders });
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
