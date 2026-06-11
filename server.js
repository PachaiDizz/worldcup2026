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
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized.');
  } catch (e) {
    console.error('Firebase Admin init failed (malformed JSON?):', e.message);
  }
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

// ── Admin Reset: POST /api/admin/reset ──
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

// ── Admin: GET /api/admin/comments ──
// Returns all comments for admin management
app.get('/api/admin/comments', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }

  try {
    const db = admin.firestore();
    const snap = await db.collection('comments').orderBy('timestamp', 'desc').limit(200).get();
    const comments = [];
    snap.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: DELETE /api/admin/comments/:id ──
// Deletes any comment by ID
app.delete('/api/admin/comments/:id', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }

  try {
    const db = admin.firestore();
    const commentId = req.params.id;
    // Delete the comment
    await db.collection('comments').doc(commentId).delete();
    // Delete any replies
    const replies = await db.collection('comments').where('parentId', '==', commentId).get();
    const batch = db.batch();
    replies.forEach(doc => batch.delete(doc.ref));
    if (replies.size > 0) await batch.commit();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: GET /api/admin/stats ──
// Returns summary stats for the admin dashboard
app.get('/api/admin/stats', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }

  try {
    const db = admin.firestore();
    const [commentsSnap, matchVotesSnap, champVotesSnap] = await Promise.all([
      db.collection('comments').get(),
      db.collection('match_votes').get(),
      db.collection('champion_votes').get()
    ]);

    let totalMatchVotes = 0;
    matchVotesSnap.forEach(doc => {
      const d = doc.data();
      totalMatchVotes += (d.votes_home || 0) + (d.votes_draw || 0) + (d.votes_away || 0);
    });

    let totalChampVotes = 0;
    champVotesSnap.forEach(doc => {
      totalChampVotes += doc.data().count || 0;
    });

    // Unique users from comments
    const users = new Set();
    commentsSnap.forEach(doc => {
      const d = doc.data();
      if (d.userId) users.add(d.userId);
      if (d.name) users.add(d.name);
    });

    res.json({
      totalComments: commentsSnap.size,
      totalMatchVotes,
      totalChampVotes,
      totalVoteDocuments: matchVotesSnap.size,
      uniqueUsers: users.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
