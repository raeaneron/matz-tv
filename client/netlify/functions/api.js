const crypto = require('crypto');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Origin': 'https://iyadtv.pages.dev',
  'Referer': 'https://iyadtv.pages.dev/'
};

function decryptIyadData(encryptedData, keyString) {
  const buffer = Buffer.from(encryptedData, 'base64');
  const iv = buffer.slice(0, 16);
  const ciphertext = buffer.slice(16);
  const keyBuffer = Buffer.alloc(16);
  keyBuffer.write(keyString.substring(0, 16), 'utf-8');
  const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

exports.handler = async (event, context) => {
  const path = event.path;
  const method = event.httpMethod;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const tokenRes = await fetch('https://api.iyad.space/token', { headers: HEADERS });
    let tokenText = "";
    try {
      tokenText = await tokenRes.text();
      const tokenData = JSON.parse(tokenText);
      var token = tokenData.token;
    } catch (parseErr) {
      return {
        statusCode: tokenRes.status,
        headers,
        body: JSON.stringify({
          error: "Failed to parse token response",
          status: tokenRes.status,
          headers: Object.fromEntries(tokenRes.headers.entries()),
          bodySnippet: tokenText.substring(0, 1000)
        })
      };
    }

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
      const channels = decryptIyadData(dataJson.data, key);
      
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
      return { statusCode: 200, headers, body: JSON.stringify(formatted) };
    }

    // Route: Stream
    if (path.endsWith('/stream') && method === 'POST') {
      const { channelName, serverIndex } = JSON.parse(event.body);
      const playRes = await fetch('https://api.iyad.space/play', {
        method: 'POST',
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, serverIndex: serverIndex || 0 })
      });
      const playData = await playRes.json();
      const streamInfo = decryptIyadData(playData.data, key);
      return { statusCode: 200, headers, body: JSON.stringify(streamInfo) };
    }

    // Route: Proxy
    if (path.includes('/proxy')) {
      const targetUrl = event.queryStringParameters.url;
      if (!targetUrl) return { statusCode: 400, headers, body: 'URL required' };

      const response = await fetch(targetUrl, { headers: HEADERS });
      if (!response.ok) {
        return { statusCode: response.status, headers, body: 'Proxy fetch failed' };
      }

      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (targetUrl.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
      else if (targetUrl.includes('.ts')) contentType = 'video/MP2T';
      else if (targetUrl.includes('.mpd')) contentType = 'application/dash+xml';

      const responseHeaders = { ...headers, 'Content-Type': contentType };

      if (targetUrl.includes('.m3u8') || targetUrl.includes('.mpd')) {
        let text = await response.text();
        const finalUrl = response.url.split('?')[0];
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const host = event.headers.host;
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        
        if (targetUrl.includes('.m3u8')) {
          text = text.split('\n').map(line => {
            // Rewrite segment URIs
            if (line.trim() && !line.startsWith('#')) {
              const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
              if (absoluteUrl.includes('.ts')) {
                return absoluteUrl; // Do NOT proxy TS chunks!
              }
              const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
              return `${protocol}://${host}/api/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}`;
            }
            // Rewrite URI attributes
            if (line.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/, (match, p1) => {
                 const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                 if (absoluteUrl.includes('.ts')) return `URI="${absoluteUrl}"`;
                 const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
                 return `URI="${protocol}://${host}/api/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}"`;
              });
            }
            return line;
          }).join('\n');
        }
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: text
        };
      } else {
        const buffer = await response.arrayBuffer();
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: Buffer.from(buffer).toString('base64'),
          isBase64Encoded: true
        };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };

  } catch (e) {
    console.error("Function Error:", e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: e.message })
    };
  }
};
