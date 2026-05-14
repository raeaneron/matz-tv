const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

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
app.get('/api/channels', async (req, res) => {
  try {
    const token = await getIyadToken();
    const key = await getIyadKey(token);
    
    const dataRes = await fetch('https://api.iyad.space/data', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const dataJson = await dataRes.json();
    
    const channels = decryptIyadData(dataJson.data, key);
    
    const formattedChannels = channels.filter(c => c.enabled !== false).map((c, index) => {
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

module.exports.handler = serverless(app);
