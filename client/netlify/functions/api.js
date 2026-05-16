const crypto = require('crypto');
const https = require('https');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Origin': 'https://iyadtv.pages.dev',
  'Referer': 'https://iyadtv.pages.dev/'
};

async function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

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
    const tokenData = await httpsRequest('https://api.iyad.space/token', { headers: HEADERS });
    const token = tokenData.token;

    const keyData = await httpsRequest('https://api.iyad.space/key', {
      headers: { ...HEADERS, 'Authorization': `Bearer ${token}` }
    });
    const key = keyData.key;

    // Route: Channels
    if (path.endsWith('/channels')) {
      const dataJson = await httpsRequest('https://api.iyad.space/data', {
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}` }
      });
      const channels = decryptIyadData(dataJson.data, key);
      
      const formatted = channels.filter(c => {
        if (c.enabled !== false) return true;
        const name = (c.name || '').toLowerCase();
        return name.includes('gma') || name.includes('kapamilya');
      }).map((c, index) => {
        const sources = [{ name: c.alt_name || "Stream 1", index: 0 }];
        for (let i = 2; i <= 10; i++) {
          if (c[`alt_name${i}`]) sources.push({ name: c[`alt_name${i}`], index: i });
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
      const playData = await httpsRequest('https://api.iyad.space/play', {
        method: 'POST',
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, serverIndex: serverIndex || 0 })
      });
      const streamInfo = decryptIyadData(playData.data, key);
      return { statusCode: 200, headers, body: JSON.stringify(streamInfo) };
    }

    // Route: Proxy
    if (path.includes('/proxy')) {
      const targetUrl = event.queryStringParameters.url;
      if (!targetUrl) return { statusCode: 400, headers, body: 'URL required' };

      return new Promise((resolve) => {
        const targetReq = https.request(targetUrl, { headers: HEADERS }, (targetRes) => {
          let chunks = [];
          targetRes.on('data', (chunk) => chunks.push(chunk));
          targetRes.on('end', () => {
            let body = Buffer.concat(chunks);
            
            // Rewrite relative URLs for HLS manifests to pass through the proxy
            if (targetUrl.includes('.m3u8')) {
              let text = body.toString('utf-8');
              const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
              const host = event.headers.host;
              const protocol = event.headers['x-forwarded-proto'] || 'https';
              
              text = text.split('\n').map(line => {
                // Rewrite segment URIs
                if (line.trim() && !line.startsWith('#')) {
                  const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
                  return `${protocol}://${host}/.netlify/functions/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                }
                // Rewrite URI attributes
                if (line.includes('URI="')) {
                  return line.replace(/URI="([^"]+)"/, (match, p1) => {
                     const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                     return `URI="${protocol}://${host}/.netlify/functions/api/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
                  });
                }
                return line;
              }).join('\n');
              body = Buffer.from(text, 'utf-8');
            }

            resolve({
              statusCode: targetRes.statusCode,
              headers: {
                ...headers,
                'Content-Type': targetRes.headers['content-type'] || 'application/octet-stream'
              },
              body: body.toString('base64'),
              isBase64Encoded: true
            });
          });
        });
        targetReq.on('error', (e) => resolve({ statusCode: 500, headers, body: e.message }));
        targetReq.end();
      });
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
