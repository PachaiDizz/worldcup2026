const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const WC_API = 'https://worldcup26.ir';

// ── Cache JWT token so we don't login on every request ──
let jwtToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (jwtToken && Date.now() < tokenExpiry) return jwtToken;

  // Try login first
  const res = await fetch(`${WC_API}/auth/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.WC_EMAIL || '',
      password: process.env.WC_PASSWORD || ''
    })
  });

  if (!res.ok) {
    // If login fails, try register
    const reg = await fetch(`${WC_API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'WorldCup2026Fan',
        email: process.env.WC_EMAIL || '',
        password: process.env.WC_PASSWORD || ''
      })
    });
    if (!reg.ok) throw new Error('Auth failed on both login and register');
    const regData = await reg.json();
    jwtToken = regData.token;
  } else {
    const data = await res.json();
    jwtToken = data.token;
  }

  // Tokens valid 84 days — cache for 80 days
  tokenExpiry = Date.now() + 80 * 24 * 60 * 60 * 1000;
  console.log('✅ worldcup26.ir token acquired');
  return jwtToken;
}

// ── Team name map: worldcup26.ir → your index.html names ──
const TEAM_MAP = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Türkiye': 'Türkiye',
  'Curacao': 'Curaçao',
  'Ivory Coast': 'Ivory Coast',
  'Côte d\'Ivoire': 'Ivory Coast',
  'Turkey': 'Türkiye',
  'Czech Republic': 'Czechia',
};

function normName(name) {
  return TEAM_MAP[name] || name;
}

// ── In-memory cache for all games (refresh every 2 min) ──
let gamesCache = null;
let gamesCacheTime = 0;
const CACHE_MS = 2 * 60 * 1000; // 2 minutes

async function fetchAllGames() {
  if (gamesCache && Date.now() - gamesCacheTime < CACHE_MS) return gamesCache;

  const token = await getToken();
  const res = await fetch(`${WC_API}/get/games`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`worldcup26.ir /get/games returned ${res.status}`);
  const data = await res.json();

  gamesCache = data;
  gamesCacheTime = Date.now();
  return gamesCache;
}

// ── Serve static files ──
app.use(express.static(path.join(__dirname)));

// ── /api/scores — convert worldcup26.ir format to football-data.org format ──
// so index.html doesn't need any changes
app.get('/api/scores', async (req, res) => {
  try {
    const games = await fetchAllGames();
    const list = Array.isArray(games) ? games : (games.games || games.matches || []);

    // Filter by date range if provided (from & to are YYYY-MM-DD)
    const { from, to } = req.query;
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to + 'T23:59:59Z').getTime() : Infinity;

    const matches = list
      .filter(g => {
        if (!g.local_date) return true;
        // local_date format: "06/11/2026 13:00" or "June 11, 2026"
        try {
          let d;
          if (g.local_date.includes('/')) {
            // "06/11/2026 13:00" — MM/DD/YYYY HH:MM
            const parts = g.local_date.split(' ')[0].split('/');
            d = new Date(`${parts[2]}-${parts[0]}-${parts[1]}T${g.local_date.split(' ')[1] || '00:00'}:00Z`);
          } else {
            d = new Date(g.local_date);
          }
          return d.getTime() >= fromMs && d.getTime() <= toMs;
        } catch { return true; }
      })
      .map(g => {
        // Determine status
        const fin = g.finished === true || g.finished === 'TRUE' || g.finished === 1;
        const te = (g.time_elapsed || '').toLowerCase();
        const inPlay = !fin && (te === 'inplay' || te === 'in_play' || te === 'live' || (te && te !== 'notstarted' && te !== 'not started'));

        let status = 'TIMED';
        if (fin) status = 'FINISHED';
        else if (inPlay) status = 'IN_PLAY';

        // Build utcDate from local_date
        let utcDate = '';
        try {
          if (g.local_date && g.local_date.includes('/')) {
            const [datePart, timePart] = g.local_date.split(' ');
            const [mm, dd, yyyy] = datePart.split('/');
            utcDate = `${yyyy}-${mm}-${dd}T${timePart || '00:00'}:00Z`;
          }
        } catch { utcDate = ''; }

        const homeScore = fin || inPlay ? (g.home_score ?? null) : null;
        const awayScore = fin || inPlay ? (g.away_score ?? null) : null;

        return {
          id: g.id || g._id,
          utcDate,
          status,
          homeTeam: { name: normName(g.home_team_name_en || g.home_team?.name_en || g.home_team || '') },
          awayTeam: { name: normName(g.away_team_name_en || g.away_team?.name_en || g.away_team || '') },
          score: {
            fullTime: { home: homeScore, away: awayScore },
            halfTime: { home: null, away: null }
          },
          minute: g.time_elapsed && !fin ? g.time_elapsed : null
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
});

// Pre-warm token on startup
getToken().catch(e => console.warn('Token pre-warm failed:', e.message));
