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
