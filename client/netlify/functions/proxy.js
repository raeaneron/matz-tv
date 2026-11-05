exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!targetUrl) {
    return { statusCode: 400, headers: corsHeaders, body: 'URL parameter required' };
  }

  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };

    const response = await fetch(targetUrl, { headers: fetchHeaders });
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: `Upstream error: ${response.status}`
      };
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
      const host = event.headers.host || 'matztv.netlify.app';
      const proto = event.headers['x-forwarded-proto'] || 'https';

      text = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
          return `${proto}://${host}/.netlify/functions/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        }
        if (line.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/, (match, p1) => {
            const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
            return `URI="${proto}://${host}/.netlify/functions/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
          });
        }
        return line;
      }).join('\n');

      return { statusCode: 200, headers: responseHeaders, body: text };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: `Proxy fetch failed: ${err.message}`
    };
  }
};
