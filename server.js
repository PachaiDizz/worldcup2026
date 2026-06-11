const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.APISPORTS_KEY || '';

// ── Team name map: api-football → your index.html names ──
const TEAM_MAP = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Curacao': 'Curaçao',
  "Côte d'Ivoire": 'Ivory Coast',
  'Ivory Coast': 'Ivory Coast',
};

function normName(name) {
  return TEAM_MAP[name] || name;
}

// ── In-memory cache (refresh every 2 min) ──
let cache = null;
let cacheTime = 0;
const CACHE_MS = 2 * 60 * 1000;

async function fetchFixtures(from, to) {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

  if (!API_KEY) throw new Error('APISPORTS_KEY not set');

  // Fetch a window of dates
  const url = `https://v3.football.api-sports.io/fixtures?league=1&season=2026&from=${from}&to=${to}`;

  const res = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY
    }
  });

  if (!res.ok) throw new Error(`api-football returned ${res.status}`);
  const data = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }

  cache = data.response || [];
  cacheTime = Date.now();
  console.log(`✅ Fetched ${cache.length} fixtures from api-football`);
  return cache;
}

// ── Serve static files ──
app.use(express.static(path.join(__dirname)));

// ── /api/scores ──
app.get('/api/scores', async (req, res) => {
  try {
    const { from, to } = req.query;

    const fixtures = await fetchFixtures(
      from || new Date().toISOString().split('T')[0],
      to   || new Date().toISOString().split('T')[0]
    );

    // Convert api-football format → football-data.org format (what index.html expects)
    const matches = fixtures.map(f => {
      const st = f.fixture.status.short; // NS, 1H, HT, 2H, FT, AET, PEN, etc.

      const isLive = ['1H','2H','ET','BT','P','INT'].includes(st);
      const isFinished = ['FT','AET','PEN'].includes(st);

      let status = 'TIMED';
      if (isFinished) status = 'FINISHED';
      else if (isLive) status = 'IN_PLAY';
      else if (st === 'HT') status = 'PAUSED';

      const homeScore = (isLive || isFinished || st === 'HT')
        ? (f.goals?.home ?? null) : null;
      const awayScore = (isLive || isFinished || st === 'HT')
        ? (f.goals?.away ?? null) : null;

      return {
        id: f.fixture.id,
        utcDate: new Date(f.fixture.timestamp * 1000).toISOString(),
        status,
        homeTeam: { name: normName(f.teams.home.name) },
        awayTeam: { name: normName(f.teams.away.name) },
        score: {
          fullTime: { home: homeScore, away: awayScore },
          halfTime: {
            home: f.score?.halftime?.home ?? null,
            away: f.score?.halftime?.away ?? null
          }
        },
        minute: isLive ? f.fixture.status.elapsed : null
      };
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    res.json({ matches });

  } catch (err) {
    console.error('Score fetch error:', err.message);
    res.status(502).json({ error: err.message, matches: [] });
  }
});

// ── Fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ WorldCup2026 server running on port ${PORT}`);
  console.log(`   API key: ${API_KEY ? '✔ set' : '✗ MISSING — set APISPORTS_KEY in Render env vars'}`);
});
