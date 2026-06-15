const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) console.warn('WARNING: ADMIN_KEY env var not set. Admin endpoints will reject all requests.');

app.use(express.json());

const SERVER_VERSION = 'v4-' + Date.now();

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, version: SERVER_VERSION, time: new Date().toISOString() });
});

app.post('/api/admin/reset', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || (req.body && req.body.key);
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  res.json({ ok: true, message: 'Reset acknowledged' });
});

app.post('/api/admin/verify', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || (req.body && req.body.key);
  if (!ADMIN_KEY) return res.status(500).json({ error: 'ADMIN_KEY not configured on server' });
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  res.json({ ok: true, message: 'Admin verified' });
});

// ── Static files ──
app.use(express.static(path.join(__dirname)));

// ── Fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
