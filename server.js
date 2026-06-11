const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Your football-data.org API key ──
// Get free key at: https://www.football-data.org/client/register
// Then set it in Render → Environment Variables as FOOTBALL_API_KEY
const API_KEY = process.env.FOOTBALL_API_KEY || '';

// ── Serve static files (index.html etc.) ──
app.use(express.static(path.join(__dirname)));

// ── Proxy: /api/scores ──
app.get('/api/scores', async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: 'API key not configured' });
  }

  const { from, to } = req.query;
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${from}&dateTo=${to}`;

  try {
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': API_KEY }
    });

    if (!response.ok) {
      throw new Error(`football-data.org returned ${response.status}`);
    }

    const data = await response.json();

    // CORS headers so the browser doesn't block it
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (err) {
    console.error('Score fetch error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Fallback: serve index.html for any other route ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ WorldCup2026 server running on port ${PORT}`);
  console.log(`   API key: ${API_KEY ? '✔ set' : '✗ MISSING — set FOOTBALL_API_KEY in Render env vars'}`);
});
