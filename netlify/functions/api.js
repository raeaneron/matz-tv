const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Origin': 'https://iyadtv.pages.dev',
  'Referer': 'https://iyadtv.pages.dev/'
};

// iYAD API Proxy Methods
async function getIyadToken() {
  const res = await axios.get('https://api.iyad.space/token', { headers: HEADERS });
  return res.data.token;
}

async function getIyadKey(token) {
  const res = await axios.get('https://api.iyad.space/key', {
    headers: { ...HEADERS, 'Authorization': 'Bearer ' + token }
  });
  return res.data.key;
}

function decryptIyadData(encryptedData, keyString) {
  try {
    const buffer = Buffer.from(encryptedData, 'base64');
    const iv = buffer.slice(0, 16);
    const ciphertext = buffer.slice(16);
    
    const keyBuffer = Buffer.alloc(16);
    keyBuffer.write(keyString.substring(0, 16), 'utf-8');
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return JSON.parse(decrypted.toString('utf-8'));
  } catch (e) {
    console.error("Decryption Error:", e.message);
    throw new Error("Decryption failed: " + e.message);
  }
}

// Routes
// Support both /api/channels and /channels to be safe
const getChannels = async (req, res) => {
  try {
    console.log("Fetching channels...");
    const token = await getIyadToken();
    const key = await getIyadKey(token);
    
    const dataRes = await axios.get('https://api.iyad.space/data', {
      headers: { ...HEADERS, 'Authorization': 'Bearer ' + token }
    });
    
    const channels = decryptIyadData(dataRes.data.data, key);
    
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
    
    console.log(`Successfully formatted ${formattedChannels.length} channels`);
    res.json(formattedChannels);
  } catch(e) {
    console.error("API Error (Channels):", e.response?.data || e.message);
    res.status(500).json({ 
      error: 'Failed to fetch channels', 
      message: e.message,
      details: e.response?.data || null
    });
  }
};

const getStream = async (req, res) => {
  try {
    const { channelName, serverIndex } = req.body;
    console.log(`Fetching stream for ${channelName} (Server ${serverIndex})...`);
    
    const token = await getIyadToken();
    const key = await getIyadKey(token);
    
    const playRes = await axios.post('https://api.iyad.space/play', 
      { channelName: channelName, serverIndex: serverIndex || 0 },
      { 
        headers: { 
          ...HEADERS,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const streamInfo = decryptIyadData(playRes.data.data, key);
    res.json(streamInfo);
  } catch(e) {
    console.error("API Error (Stream):", e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch stream', message: e.message });
  }
};

app.get('/api/channels', getChannels);
app.get('/channels', getChannels); // Fallback

app.post('/api/stream', getStream);
app.post('/stream', getStream); // Fallback

module.exports.handler = serverless(app);
