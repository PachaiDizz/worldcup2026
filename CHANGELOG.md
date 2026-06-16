# Changelog — Football World Cup 2026 Matches

## 12 Jun 2026 — Security, Deduplication & Performance Review

All changes committed in `d3fbcd2` and pushed to `main`.

---

### Security Fixes

| # | Fix | File |
|---|-----|------|
| 1 | Removed hardcoded `ADMIN_KEY` from client-side JS | `index.html` |
| 2 | Fixed XSS in all `onclick` attributes — added `escapeAttr()` helper to escape `\ ' " < >` in team names, venues, and comment names | `index.html` |
| 12 | Removed `'wc26admin'` fallback in `server.js` — `ADMIN_KEY` now required via env var | `server.js` |

**`escapeAttr()` applied to:**
- `renderFavBar()` — team name in `toggleFav()`
- `buildCard()` — team names in `toggleReminder()`, `shareWhatsApp()`, `voteMatch()`, and venue in `shareWhatsApp()`
- Champion vote buttons — team name in `voteChampion()` (both `renderChampionSection` and `onSnapshot` listener)
- Comment reply button — comment name in `startReply()`

**Reminder button selector** changed from `[onclick*="toggleReminder(${matchNo},"]` to `[data-reminder="${matchNo}"]` for safer DOM queries.

---

### Code Deduplication

| # | Fix | File |
|---|-----|------|
| 4 | Extracted `buildVoteResultHTML(d)` — shared vote percentage bar HTML, used by `refreshVoteResult()` and match_votes `onSnapshot` | `index.html` |
| 5 | Extracted `buildChampGridHTML(counts, totalVotes)` and `buildChampLeaderboardHTML(counts, totalVotes)` — shared champion rendering, used by `renderChampionSection()` and champion_votes `onSnapshot` | `index.html` |
| 6 | Removed dead code: `renderVoteResult()`, `loadAllVoteResults()` | `index.html` |

---

### Performance

| # | Fix | File |
|---|-----|------|
| 8 | `scheduleRefresh()` now compares API data key before/after fetch — skips `buildSchedule()` if nothing changed | `index.html` |
| 9 | Added `debounce(fn, ms)` helper — search input debounced at 300ms | `index.html` |

---

### Bug Fixes

| # | Fix | File |
|---|-----|------|
| 7 | Removed duplicate `.vote-result`, `.vote-pct` CSS rules (were copy-pasted twice) | `index.html` |
| 10 | `check_deploy.js` — changed `/api/scores` (non-existent) to `/api/ping` | `check_deploy.js` |
| 11 | ICS download was already correct (only on set, not remove) — no change needed | — |

---

### Config Changes

| File | Change |
|------|--------|
| `server.js` | `ADMIN_KEY` now required from `process.env.ADMIN_KEY`, no fallback. Warning logged if not set. |
| `.env.example` | Updated `ADMIN_KEY` placeholder to `your-secret-admin-key-here` |
| `render.yaml` | Added `ADMIN_KEY: sync: false` env var entry |

---

### Functions Added

- `escapeAttr(s)` — escapes strings for safe use in HTML attributes/onclick
- `debounce(fn, ms)` — standard debounce wrapper
- `buildVoteResultHTML(d)` — returns vote percentage bar HTML
- `buildChampGridHTML(counts, totalVotes)` — returns paginated champion grid HTML
- `buildChampLeaderboardHTML(counts, totalVotes)` — returns champion leaderboard HTML
- `getApiDataKey()` — returns JSON string of `apiData` for change detection

### Functions Removed

- `renderVoteResult()` — dead code, never called
- `loadAllVoteResults()` — dead code, never called

### Variables Added

- `lastDataKey` — tracks previous API data state for change detection

---

## 16 Jun 2026 — Security Hardening, Admin Gate & UX Improvement

All changes committed in `adabe91` and pushed to `main`.

---

### Security Fixes

| # | Fix | File |
|---|-----|------|
| 1 | **XSS: Replace all inline `onclick` handlers with `data-*` attributes + `addEventListener`** — eliminates user data flowing through JS string literals in HTML | `index.html` |
| 2 | **Admin panel gated behind server-side `ADMIN_KEY` check** — new `POST /api/admin/verify` endpoint; `showAdminPanels()` now prompts for key and verifies before revealing panels | `index.html`, `server.js` |
| 3 | **Removed hardcoded default scores** (Mexico 2-0 South Africa, South Korea 2-1 Czechia) — scores now come exclusively from the GitHub Gist | `index.html` |

**XSS fix applied to:**
- `renderFavBar()` — favourite chip buttons (`data-fav-team`)
- `buildCard()` — WhatsApp buttons (`data-wa-*`), reminder buttons (`data-reminder`, `data-home`, `data-away`, `data-utc`), vote buttons (`data-vote-key`, `data-vote-choice`, `data-vote-no`)
- `buildChampGridHTML()` — champion vote buttons (`data-champ-team`)
- `buildCommentEl()` — reply buttons (`data-reply-id`, `data-reply-name`), delete buttons (`data-delete-id`)

**Admin gate flow:**
1. User clicks footer 5x (or visits `?admin=1`)
2. `showAdminPanels()` prompts for admin key
3. Key verified via `POST /api/admin/verify` with `X-Admin-Key` header
4. Key stored in `sessionStorage` for the session
5. Panels only shown if verification succeeds

---

### UX Improvement

| # | Fix | File |
|---|-----|------|
| 4 | **Auto-navigate to page with today's/current matches on first load** — instead of always showing page 1, the site finds the first non-finished match and jumps to its page | `index.html` |

**Logic:**
- On first `buildSchedule()` call, `initialPageSet` flag is `false`
- Finds first match where `matchTime + 2h > now` (i.e., not yet finished)
- Sets `currentPage` to that match's page number
- Flag set to `true` — subsequent filter changes paginate normally

---

### Functions Added

- `POST /api/admin/verify` — server endpoint to verify admin key

### Variables Added

- `initialPageSet` — tracks whether auto-page navigation has run (one-time flag)

### Config Changes

| File | Change |
|------|--------|
| `server.js` | Added `POST /api/admin/verify` endpoint for admin key verification |

---

## 16 Jun 2026 — Cleanup Pass (post‑security‑hardening)

All changes in branch `cleanup/finish-onclick-migration` (no merge yet).

---

### Code Consistency

| # | Fix | File |
|---|-----|------|
| 1 | Migrated the 5 remaining static `onclick=` attributes (cancel reply, submit comment, reset data, set score, clear score) to `data-action` + a single delegated `document.addEventListener('click', …)` dispatcher | `index.html` |
| 2 | Migrated schedule pagination `prevBtn.onclick` / `nextBtn.onclick` to `addEventListener` (champion pagination was already done in `adabe91`) | `index.html` |

### Performance

| # | Fix | File |
|---|-----|------|
| 3 | Cached countdown (`#cd-*`) and clock (`#myt-*`) DOM nodes into `cdNodes` / `clockNodes` constants — removes 14 `getElementById` calls/sec from the 1s intervals | `index.html` |

### Docs

| File | Change |
|------|--------|
| `PROGRESS.md` | Refreshed "Current State" to 16 Jun 2026, removed the "Pending Issues" list (all items remediated in `d3fbcd2`/`adabe91`), and added a "Known Limitations / Future Work" section listing the deeper items still open (rate limiting, Cloud Function vote integrity, `.gitignore`, CSP, legacy-comment `userId` backfill) |
| `CHANGELOG.md` | This entry |

### Variables Added

- `cdNodes` — cached countdown DOM nodes (`name`, `d`, `h`, `m`, `s`)
- `clockNodes` — cached clock DOM nodes (`time`, `date`)

### Still Open (deferred from this pass)

- `server.js` hardening (`helmet` + `express-rate-limit` on `/api/admin/*`)
- Firestore rules tightening on `match_votes` / `champion_votes` to prevent arbitrary `set()`
- `.gitignore` for `node_modules/` and `.env`
- `Content-Security-Policy` header
- Backfill `userId` on pre-update comments so the delete button appears for them
