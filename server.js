const express = require('express');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FOOTBALL_API_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY;
const API_BASE = 'https://api.football-data.org/v4';

if (!API_KEY) {
  console.error('ERROR: FOOTBALL_API_KEY environment variable is not set.');
  console.error('Set it in your Render dashboard under Environment Variables.');
}

// ── Firebase Admin SDK (for server-side reset) ──
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin initialized.');
} else {
  console.warn('WARNING: FIREBASE_SERVICE_ACCOUNT not set. Admin reset will not work.');
}

// ── API Proxy: /api/scores ──
// Hides the API key from the browser. Client calls /api/scores?from=X&to=Y
app.get('/api/scores', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing "from" or "to" query params' });
  }

  try {
    const url = `${API_BASE}/competitions/WC/matches?dateFrom=${from}&dateTo=${to}`;
    const apiRes = await fetch(url, {
      headers: { 'X-Auth-Token': API_KEY }
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return res.status(apiRes.status).json({ error: `Football API error: ${apiRes.status}`, detail: text });
    }

    const data = await apiRes.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch from football-data.org' });
  }
});

// ── Admin Reset: DELETE /api/admin/reset ──
// Requires ADMIN_KEY in header. Deletes all Firestore data.
app.post('/api/admin/reset', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden: invalid or missing ADMIN_KEY' });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not configured on server' });
  }

  const db = admin.firestore();
  const collections = ['match_votes', 'champion_votes', 'comments'];

  try {
    for (const col of collections) {
      const snapshot = await db.collection(col).get();
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      if (snapshot.size > 0) await batch.commit();
    }
    res.json({ success: true, message: 'All data reset successfully' });
  } catch (err) {
    console.error('Admin reset error:', err);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

// ── Serve static files (index.html, etc.) ──
app.use(express.static(path.join(__dirname)));

// ── SPA fallback: any other route → index.html ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`World Cup 2026 server running on port ${PORT}`);
});
