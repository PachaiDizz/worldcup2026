# Football World Cup 2026 Matches — Development Log

## Project Overview
Dark-themed FIFA World Cup 2026 live scores & schedule tracker for Malaysian users (MYT/UTC+8). Scores come from a **GitHub Gist** JSON file updated by **Hermes** Telegram bot. Firebase backend for votes/comments.

**Stack:** Vanilla HTML/CSS/JS, Firebase Firestore, Express static file server, Render hosting, GitHub Gist (data layer)

---

## Current State (16 Jun 2026)

### What's Working
- **Frontend** (`index.html`): Full schedule, match cards, champion voting, comments, reminders, WhatsApp share — all deployed
- **48 qualified teams** in `CHAMPION_CANDIDATES` and `MATCHES` array
- **Firebase**: Match votes, champion votes, comments with real-time listeners
- **Auto-refresh**: Every 30s if live matches, 5min otherwise; `scheduleRefresh()` skips rebuilds when Gist data hasn't changed (`getApiDataKey()` comparison)
- **Scores embedded in team names** — `Mexico (2)` directly in match cards
- **No hardcoded score fallbacks** — all scores come from the Gist
- **Admin gate** (`?admin=1` or click footer 5×): `POST /api/admin/verify` checks the server-side `ADMIN_KEY` before revealing panels; key stored in `sessionStorage` only after verification
- **XSS hardened**: All dynamic handlers use `data-*` + `addEventListener`; `escapeHTML`/`escapeAttr` for any remaining innerHTML interpolation
- **Auto-page to current match**: First `buildSchedule()` finds the first non-finished match and jumps to its page; subsequent filter changes paginate normally
- **Search debounced at 300 ms** via `debounce(fn, ms)` helper
- **Skeleton loading** placeholders for the schedule and champion grids

### Data Flow
1. **Hermes** (Telegram bot) → writes score JSON to GitHub Gist via GitHub API
2. **Static site** (`index.html`) → fetches `GIST_URL` on load and every refresh cycle
3. **Admin Panel** (`?admin=1`) → preview scores locally, copy JSON snippet, send to Hermes
4. **No external football API needed** — no API keys, no proxy server required

### Server.js
- Stripped down to just serve static files
- `/api/ping` — health check
- `/api/admin/reset` — Firebase data reset (votes, comments) — gated by `X-Admin-Key`
- `/api/admin/verify` — admin key verification — gated by `X-Admin-Key`
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

Status values: `TIMED`, `IN_PLAY`, `PAUSED`, `FINISHED`, `EXTRA_TIME`, `PENALTY_SHOOTOUT`

### Hermes — GitHub Gist API call

```
PATCH https://api.github.com/gists/{gist_id}
Authorization: Bearer {github_token}

{ "files": { "scores.json": { "content": "{...updated JSON...}" } } }
```

---

## Known Limitations / Future Work

- **Anonymous auth is the only sign-in** — users can clear `localStorage` and get a new identity, so vote stuffing and comment spam are not prevented at the auth layer. Acceptable for a fun fan project; would need CAPTCHA or a Cloud Function with rate limits to harden.
- **Firestore rules allow arbitrary `update` on vote docs** — any signed-in user can call `set()` to inflate counts. The client uses `FieldValue.increment`, but rules don't enforce that. Tighten via Cloud Functions for production integrity.
- **No rate limiting on `/api/admin/*`** — Express is bare. Adding `helmet` + `express-rate-limit` would close a brute-force path against the admin key.
- **No `.gitignore`** — should ignore `node_modules/` and `.env` to keep the working tree clean.
- **No CSP header** — `Content-Security-Policy` would be a notable upgrade; trade-off is the inline `<style>` block.
- **Pre-existing comments have no `userId`** so the delete button won't appear on them — would need a one-time migration to backfill `userId` from `localStorage` for any session that posted one.

### Next Steps
1. ~~Create a GitHub Gist with an empty `scores.json` `{}`~~ ✅
2. ~~Copy the raw URL and paste into `GIST_URL` in `index.html`~~ ✅
3. ~~Deploy to Render~~ ✅
4. ~~Set up Hermes to call the Gist API via Telegram commands~~ ✅
5. [Optional] Add a direct "Push to Gist" button in admin panel (uses GitHub API token)
6. [Optional] Move vote writes through a Cloud Function with rate limiting
