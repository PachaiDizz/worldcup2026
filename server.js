const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FOOTBALL_API_KEY || process.env.APISPORTS_KEY || '';

const TEAM_MAP = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Curacao': 'Curaçao',
  "Côte d'Ivoire": 'Ivory Coast',
  'Ivory Coast': 'Ivory Coast',
};

function normName(name) { return TEAM_MAP[name] || name; }

const ADMIN_KEY = process.env.ADMIN_KEY || 'wc26admin';
const manualMatchNo = {};

let cache = null;
let cacheTime = 0;
const CACHE_MS = 2 * 60 * 1000;

async function fetchFixtures(from, to) {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;
  if (!API_KEY) throw new Error('FOOTBALL_API_KEY not set');
  const url = `https://v3.football.api-sports.io/fixtures?league=1&season=2026&from=${from}&to=${to}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) throw new Error(`api-football returned ${res.status}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
  cache = data.response || [];
  cacheTime = Date.now();
  return cache;
}

app.use(express.json());

// ── API routes BEFORE static ──

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/admin/set-score', (req, res) => {
  const { key, match, home, away, status } = req.query;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  const matchNo = parseInt(match, 10);
  if (isNaN(matchNo) || matchNo < 1) return res.status(400).json({ error: 'Invalid match number' });
  const homeScore = parseInt(home, 10);
  const awayScore = parseInt(away, 10);
  if (isNaN(homeScore) || isNaN(awayScore)) return res.status(400).json({ error: 'Invalid score values' });
  manualMatchNo[String(matchNo)] = { home: homeScore, away: awayScore, status: status || 'FINISHED', setAt: new Date().toISOString() };
  console.log(`Manual score: M${matchNo} = ${homeScore}-${awayScore} (${status || 'FINISHED'})`);
  res.json({ ok: true, match: matchNo, home: homeScore, away: awayScore, status: status || 'FINISHED' });
});

app.get('/api/admin/clear-score', (req, res) => {
  const { key, match } = req.query;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  if (match === 'all') {
    Object.keys(manualMatchNo).forEach(k => delete manualMatchNo[k]);
    return res.json({ ok: true, cleared: 'all' });
  }
  const matchNo = String(parseInt(match, 10));
  if (manualMatchNo[matchNo]) { delete manualMatchNo[matchNo]; return res.json({ ok: true, cleared: matchNo }); }
  res.status(404).json({ error: 'No manual score for that match' });
});

app.post('/api/admin/reset', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || (req.body && req.body.key);
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  res.json({ ok: true, message: 'Reset acknowledged' });
});

app.get('/api/scores', async (req, res) => {
  try {
    const { from, to } = req.query;
    let fixtures;
    try {
      fixtures = await fetchFixtures(
        from || new Date().toISOString().split('T')[0],
        to || new Date().toISOString().split('T')[0]
      );
    } catch (apiErr) {
      const manualMatches = Object.entries(manualMatchNo).map(([no, s]) => ({
        id: `manual-${no}`, utcDate: new Date().toISOString(), status: s.status,
        homeTeam: { name: `Match ${no}` }, awayTeam: { name: '' },
        score: { fullTime: { home: s.home, away: s.away }, halfTime: { home: null, away: null } },
        minute: null, _manual: true, _matchNo: parseInt(no)
      }));
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'no-store');
      return res.json({ matches: manualMatches, _manualFallback: true });
    }

    const matches = fixtures.map(f => {
      const st = f.fixture.status.short;
      const isLive = ['1H','2H','ET','BT','P','INT'].includes(st);
      const isFinished = ['FT','AET','PEN'].includes(st);
      const fid = String(f.fixture.id);
      const manual = manualMatchNo[fid];
      let status = 'TIMED';
      if (manual) status = manual.status;
      else if (isFinished) status = 'FINISHED';
      else if (isLive) status = 'IN_PLAY';
      else if (st === 'HT') status = 'PAUSED';
      const hScore = manual ? manual.home : (isLive || isFinished || st === 'HT') ? (f.goals?.home ?? null) : null;
      const aScore = manual ? manual.away : (isLive || isFinished || st === 'HT') ? (f.goals?.away ?? null) : null;
      return {
        id: f.fixture.id,
        utcDate: new Date(f.fixture.timestamp * 1000).toISOString(),
        status,
        homeTeam: { name: normName(f.teams.home.name) },
        awayTeam: { name: normName(f.teams.away.name) },
        score: { fullTime: { home: hScore, away: aScore }, halfTime: { home: f.score?.halftime?.home ?? null, away: f.score?.halftime?.away ?? null } },
        minute: manual ? null : (isLive ? f.fixture.status.elapsed : null),
        _manual: !!manual
      };
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    res.json({ matches });
  } catch (err) {
    console.error('Score error:', err.message);
    res.status(502).json({ error: err.message, matches: [] });
  }
});

// ── Static files ──
app.use(express.static(path.join(__dirname)));

// ── Fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API key: ${API_KEY ? 'set' : 'MISSING'}`);
  console.log(`Admin key: ${ADMIN_KEY}`);
});
