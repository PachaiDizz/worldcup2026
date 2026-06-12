# Football World Cup 2026 Matches — Development Log

## Project Overview
Dark-themed FIFA World Cup 2026 live scores & schedule tracker for Malaysian users (MYT/UTC+8). Scores come from a **GitHub Gist** JSON file updated by **Hermes** Telegram bot. Firebase backend for votes/comments.

**Stack:** Vanilla HTML/CSS/JS, Firebase Firestore, Express static file server, Render hosting, GitHub Gist (data layer)

---

## Current State (12 Jun 2026)

### What's Working
- **Frontend** (`index.html`): Full schedule, match cards, champion voting, comments, reminders, WhatsApp share — all deployed
- **48 qualified teams** in `CHAMPION_CANDIDATES` and `MATCHES` array
- **Firebase**: Match votes, champion votes, comments with real-time listeners
- **Auto-refresh**: Every 30s if live matches, 5min otherwise
- **Scores embedded in team names** — removed separate `.score-big` box; scores now show as `Mexico (2)` directly in match cards
- **Default fallback scores** for completed matches (Mexico 2–0 South Africa, South Korea 2–1 Czechia) if Gist has no data
- **Admin panel** (`?admin=1`) for manual score preview with JSON snippet output for Hermes
- **Removed floating "Final Scores" panel** — all scores consolidated into match cards

### Data Flow
1. **Hermes** (Telegram bot) → writes score JSON to GitHub Gist via GitHub API
2. **Static site** (`index.html`) → fetches `GIST_URL` on load and every refresh cycle
3. **Admin Panel** (`?admin=1`) → preview scores locally, copy JSON snippet, send to Hermes
4. **No external football API needed** — no API keys, no proxy server required

### Server.js
- Stripped down to just serve static files
- `/api/ping` — health check
- `/api/admin/reset` — Firebase data reset (votes, comments)
- No score endpoints (Hermes handles Gist updates directly)

---

## Gist JSON Format (keyed by match number 1–104)

```json
{
  "1": { "homeScore": 2, "awayScore": 1, "status": "FINISHED" },
  "3": { "homeScore": 1, "awayScore": 0, "status": "IN_PLAY", "minute": 67 },
  "4": { "homeScore": 2, "awayScore": 2, "status": "PAUSED", "halfHome": 2, "halfAway": 2 }
}
```

Status values: `TIMED`, `IN_PLAY`, `PAUSED`, `FINISHED`

### Hermes — GitHub Gist API call

```
PATCH https://api.github.com/gists/{gist_id}
Authorization: Bearer {github_token}

{ "files": { "scores.json": { "content": "{...updated JSON...}" } } }
```

---

## Pending Items / Known Issues

- **Firebase config exposed** — ensure Firestore security rules restrict writes
- **XSS in onclick attributes** — team names injected unsafely into `onclick` strings
- `.vote-result` CSS rules duplicated
- Existing pre-update comments have no `userId` so delete button won't appear

### Next Steps
1. ~~Create a GitHub Gist with an empty `scores.json` `{}`~~ ✅
2. ~~Copy the raw URL and paste into `GIST_URL` in `index.html`~~ ✅
3. ~~Deploy to Render~~ ✅
4. ~~Set up Hermes to call the Gist API via Telegram commands~~ ✅
5. [Optional] Add a direct "Push to Gist" button in admin panel (uses GitHub API token)
