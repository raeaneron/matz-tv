const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Origin': 'https://iyadtv.pages.dev',
  'Referer': 'https://iyadtv.pages.dev/'
};

exports.handler = async (event, context) => {
  try {
    const url = event.queryStringParameters.url;
    if (!url) {
      return { statusCode: 400, body: 'URL required' };
    }

    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      return { statusCode: response.status, body: 'Proxy fetch failed' };
    }

    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (url.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
    else if (url.includes('.ts')) contentType = 'video/MP2T';
    else if (url.includes('.mpd')) contentType = 'application/dash+xml';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': contentType
    };

    if (url.includes('.m3u8') || url.includes('.mpd')) {
      let text = await response.text();
      const finalUrl = response.url.split('?')[0];
      const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      const host = event.headers.host;
      const protocol = event.headers['x-forwarded-proto'] || 'https';
      
      if (url.includes('.m3u8')) {
        text = text.split('\n').map(line => {
          if (line.trim() && !line.startsWith('#')) {
            const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
            if (absoluteUrl.includes('.ts')) {
              return `${protocol}://${host}/.netlify/functions/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            }
            const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
            return `${protocol}://${host}/.netlify/functions/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}`;
          }
          if (line.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/, (match, p1) => {
               const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
               if (absoluteUrl.includes('.ts')) {
                 return `URI="${protocol}://${host}/.netlify/functions/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
               }
               const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
               return `URI="${protocol}://${host}/.netlify/functions/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}"`;
            });
          }
          return line;
        }).join('\n');
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: text
      };
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: buffer.toString('base64'),
        isBase64Encoded: true
      };
    }
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: 'Internal Server Error: ' + e.message
    };
  }
};
