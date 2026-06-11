const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FOOTBALL_API_KEY || process.env.APISPORTS_KEY || '';

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

// ── Manual score overrides (admin) ──
const ADMIN_KEY = process.env.ADMIN_KEY || 'wc26admin';
const manualScores = {}; // fixtureId → { home, away, status }
const manualMatchNo = {}; // matchNo → { homeName, awayName, home, away, status }

// ── In-memory cache (refresh every 2 min) ──
let cache = null;
let cacheTime = 0;
const CACHE_MS = 2 * 60 * 1000;

async function fetchFixtures(from, to) {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

  if (!API_KEY) throw new Error('FOOTBALL_API_KEY not set');

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
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Admin: reset endpoint (frontend handles localStorage; server validates key) ──
app.post('/api/admin/reset', async (req, res) => {
  const adminKey = req.headers['x-admin-key'] || (req.body && req.body.key);
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }
  console.log('⚡ Admin reset requested (localStorage cleared on client)');
  res.json({ ok: true, message: 'Reset acknowledged. Client will clear local data.' });
});

// ── Admin: set manual score by match number ──
app.get('/api/admin/set-score', (req, res) => {
  const { key, match, home, away, status } = req.query;

  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }

  const matchNo = parseInt(match, 10);
  if (isNaN(matchNo) || matchNo < 1) {
    return res.status(400).json({ error: 'Invalid match number' });
  }

  const homeScore = parseInt(home, 10);
  const awayScore = parseInt(away, 10);
  if (isNaN(homeScore) || isNaN(awayScore)) {
    return res.status(400).json({ error: 'Invalid score values' });
  }

  const matchStatus = status || 'FINISHED';

  manualMatchNo[matchNo] = {
    home: homeScore,
    away: awayScore,
    status: matchStatus,
    setAt: new Date().toISOString()
  };

  console.log(`⚡ Manual score set: Match ${matchNo} = ${homeScore}-${awayScore} (${matchStatus})`);

  res.json({
    ok: true,
    match: matchNo,
    home: homeScore,
    away: awayScore,
    status: matchStatus
  });
});

// ── Admin: clear manual score ──
app.get('/api/admin/clear-score', (req, res) => {
  const { key, match } = req.query;

  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }

  if (match === 'all') {
    Object.keys(manualMatchNo).forEach(k => delete manualMatchNo[k]);
    console.log('⚡ All manual scores cleared');
    return res.json({ ok: true, cleared: 'all' });
  }

  const matchNo = parseInt(match, 10);
  if (manualMatchNo[matchNo]) {
    delete manualMatchNo[matchNo];
    console.log(`⚡ Manual score cleared for match ${matchNo}`);
    return res.json({ ok: true, cleared: matchNo });
  }

  res.status(404).json({ error: 'No manual score for that match' });
});

// ── Admin: list current overrides ──
app.get('/api/admin/scores', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }
  res.json({ overrides: manualMatchNo });
});

// ── /api/scores ──
app.get('/api/scores', async (req, res) => {
  try {
    const { from, to } = req.query;

    let fixtures;
    try {
      fixtures = await fetchFixtures(
        from || new Date().toISOString().split('T')[0],
        to   || new Date().toISOString().split('T')[0]
      );
    } catch (apiErr) {
      console.warn('API fetch failed, using manual scores only:', apiErr.message);
      // Return manual-only response
      const manualMatches = Object.entries(manualMatchNo).map(([no, s]) => ({
        id: `manual-${no}`,
        utcDate: new Date().toISOString(),
        status: s.status,
        homeTeam: { name: s.homeName || `Match ${no}` },
        awayTeam: { name: s.awayName || '' },
        score: {
          fullTime: { home: s.home, away: s.away },
          halfTime: { home: null, away: null }
        },
        minute: null,
        _manual: true,
        _matchNo: parseInt(no)
      }));
      if (manualMatches.length === 0) {
        throw apiErr; // re-throw if no manual data either
      }
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'no-store');
      return res.json({ matches: manualMatches, _manualFallback: true });
    }

    // Convert api-football format → football-data.org format (what index.html expects)
    const matches = fixtures.map(f => {
      const st = f.fixture.status.short; // NS, 1H, HT, 2H, FT, AET, PEN, etc.

      const isLive = ['1H','2H','ET','BT','P','INT'].includes(st);
      const isFinished = ['FT','AET','PEN'].includes(st);

      // Check for manual override by match number (if we have a mapping) or by fixture id
      const fid = f.fixture.id;
      const manual = manualScores[fid] || manualMatchNo[fid];

      let status = 'TIMED';
      if (manual) status = manual.status;
      else if (isFinished) status = 'FINISHED';
      else if (isLive) status = 'IN_PLAY';
      else if (st === 'HT') status = 'PAUSED';

      const homeScore = manual ? manual.home
        : (isLive || isFinished || st === 'HT') ? (f.goals?.home ?? null) : null;
      const awayScore = manual ? manual.away
        : (isLive || isFinished || st === 'HT') ? (f.goals?.away ?? null) : null;

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
        minute: manual ? null : (isLive ? f.fixture.status.elapsed : null),
        _manual: !!manual
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
  console.log(`   API key: ${API_KEY ? '✔ set' : '✗ MISSING — set FOOTBALL_API_KEY in Render env vars'}`);
  console.log(`   Admin key: ${ADMIN_KEY === 'wc26admin' ? '⚠ using default' : '✔ custom'}`);
});
