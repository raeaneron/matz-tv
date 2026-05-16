const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const crypto = require('crypto')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json())

if (process.env.MONGO_URI && process.env.MONGO_URI !== 'YOUR_MONGODB_URL') {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB connection error:', err))
} else {
  console.log('MongoDB URI not provided or default used. Skipping DB connection.');
}

// iYAD API Proxy Methods
async function getIyadToken() {
  const tokenRes = await fetch('https://api.iyad.space/token');
  const tokenData = await tokenRes.json();
  return tokenData.token;
}

async function getIyadKey(token) {
  const keyRes = await fetch('https://api.iyad.space/key', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const keyData = await keyRes.json();
  return keyData.key;
}

function decryptIyadData(encryptedData, keyString) {
  const buffer = Buffer.from(encryptedData, 'base64');
  const iv = buffer.slice(0, 16);
  const ciphertext = buffer.slice(16);
  
  const keyBuffer = Buffer.alloc(16);
  keyBuffer.write(keyString, 'utf-8');
  
  const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return JSON.parse(decrypted.toString('utf-8'));
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'MATZ TV API RUNNING' })
})

app.get('/api/channels', async (req, res) => {
  try {
    const token = await getIyadToken();
    const key = await getIyadKey(token);
    
    const dataRes = await fetch('https://api.iyad.space/data', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const dataJson = await dataRes.json();
    
    const channels = decryptIyadData(dataJson.data, key);
    
    const formattedChannels = channels.filter(c => {
      if (c.enabled !== false) return true;
      const name = c.name.toLowerCase();
      return name.includes('gma') || name.includes('kapamilya');
    }).map((c, index) => {
      const sources = [{ name: c.alt_name || "Stream 1", index: 0 }];
      
      for(let i = 2; i <= 10; i++) {
        const altName = c[`alt_name${i}`];
        if (altName) {
          sources.push({ name: altName, index: i });
        }
      }

      return {
        id: index + 1,
        name: c.name,
        category: c.tags && c.tags.length > 0 ? c.tags[0].toUpperCase() : 'LIVE TV',
        logo: c.logo || "https://placehold.co/300x170/222222/ffffff?text=" + encodeURIComponent(c.name),
        sources: sources
      };
    });
    
    res.json(formattedChannels);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.post('/api/stream', async (req, res) => {
  try {
    const { channelName, serverIndex } = req.body;
    
    const token = await getIyadToken();
    const key = await getIyadKey(token);
    
    const playRes = await fetch('https://api.iyad.space/play', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelName: channelName, serverIndex: serverIndex || 0 })
    });
    
    if (!playRes.ok) {
       return res.status(403).json({ error: 'Playback Unauthorized' });
    }
    
    const playJson = await playRes.json();
    const streamInfo = decryptIyadData(playJson.data, key);
    
    res.json(streamInfo);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

app.get('/api/proxy', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL required');

    const response = await fetch(url, {
      headers: {
        'Referer': 'https://iyadtv.pages.dev/',
        'Origin': 'https://iyadtv.pages.dev/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return res.status(response.status).send('Proxy fetch failed');

    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (url.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
    else if (url.includes('.ts')) contentType = 'video/MP2T';
    else if (url.includes('.mpd')) contentType = 'application/dash+xml';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url.includes('.m3u8') || url.includes('.mpd')) {
      let text = await response.text();
      // Use response.url (after redirects) instead of original url
      const finalUrl = response.url.split('?')[0];
      const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      
      if (url.includes('.m3u8')) {
        text = text.split('\n').map(line => {
          // Rewrite segment URIs to go through the proxy
          if (line.trim() && !line.startsWith('#')) {
            const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
            const host = req.get('host');
            const protocol = req.protocol || 'http';
            const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : (absoluteUrl.includes('.ts') ? '/stream.ts' : '');
            return `${protocol}://${host}/api/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}`;
          }
          // Also rewrite URI="..." within tags like EXT-X-KEY or EXT-X-MEDIA
          if (line.includes('URI="')) {
             return line.replace(/URI="([^"]+)"/, (match, p1) => {
                 const absoluteUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                 const host = req.get('host');
                 const protocol = req.protocol || 'http';
                 const ext = absoluteUrl.includes('.m3u8') ? '/stream.m3u8' : '';
                 return `URI="${protocol}://${host}/api/proxy${ext}?url=${encodeURIComponent(absoluteUrl)}"`;
             });
          }
          return line;
        }).join('\n');
      }
      
      res.send(text);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Proxy error');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
