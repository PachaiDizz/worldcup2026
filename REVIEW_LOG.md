# Football World Cup 2026 Matches — Change Log & Review

A consolidated record of every change made during the code review + cleanup session
(15–16 Jun 2026), plus the deferred items still open. Use this to catch up on the
project's evolution or roll back specific changes.

---

## Session 1 — Code Review (15 Jun 2026)

Read-only review of `CHANGELOG.md`, `README.md`, `PROGRESS.md`, `package.json`,
`render.yaml`, `firestore.rules`, `server.js`, `check_deploy.js`, `.env.example`,
and the full 1,715-line `index.html`.

### What's working well
- Security posture is solid for a static+Firebase project:
  - Server-side admin gate via `POST /api/admin/verify`
  - Firestore rules restrict delete to `resource.data.userId`
  - No `ADMIN_KEY` fallback in `server.js`
  - `ADMIN_KEY` declared in `render.yaml` with `sync: false`
- XSS surface is mostly closed: user data flows through `data-*` + `addEventListener`;
  `escapeHTML` / `escapeAttr` are used in the few remaining innerHTML template sites
- No hardcoded fallbacks for scores anymore — all data comes from the Gist
- Smart auto-refresh with `getApiDataKey()` comparison — skips DOM rebuild on no-change
- Real deduplication of vote rendering (`buildVoteResultHTML` shared by action and
  snapshot paths; same for champion grid/leaderboard)
- Search debounced at 300 ms
- Mobile breakpoint at 600 px
- `static` directory served via `express.static`

### Issues found
**High**
1. Five remaining `onclick=` attributes in static HTML
2. Two `innerHTML` writes interpolate into CSS / attribute strings without explicit
   escaping (`getFlagImg` style, `card-bottom` title)
3. Anonymous auth is real user-fingerprinting weakness — UID is just a localStorage
   value; can be reset to get a new identity
4. `PROGRESS.md` was stale and contradicted the changelog

**Medium**
5. `escapeAttr` order is questionable — backslash escapes don't apply in HTML attr
   context
6. `apiSt === 'PAUSED'` magic string in three places — consider a `deriveView(api)`
   helper
7. `updateCountdown` / `updateClock` re-query the DOM by id every second
8. `champ-pagination` was the only place using `onclick =` after the data-attribute
   migration (schedule pagination too)
9. `auth.signInAnonymously()` fallback uses `Math.random()` for `userId` — Firestore
   delete will silently fail for unauth users since rules require `request.auth.uid`
10. `server.js` lacks `helmet` and rate limiting on `/api/admin/*` — brute-force risk
11. `firestore.rules` allow arbitrary `update` on vote docs — user can `set()` counts

**Low / nice-to-have**
- `voteMatch` / `voteChampion` are read-modify-write without a transaction
- Hardcoded Render URL in `shareWhatsApp` / `getFlagImg`
- Repeated skeleton placeholders (6× champ, 3× schedule)
- `scheduleRefresh` not cleared on `pagehide`
- `buildCard` is 130+ lines
- `firebase.analytics()` loaded on every page
- `.skeleton` doesn't respect `prefers-reduced-motion`
- Inconsistent init: script vs `DOMContentLoaded`
- No `.gitignore`
- No CSP header

---

## Session 2 — Small, Safe Fixes (16 Jun 2026, branch `cleanup/finish-onclick-migration`)

User opted for "small, safe fixes only" — defer security hardening to a later pass.

### Changes in commit `d293f2d` — *Finish onclick migration and clean up PROGRESS/CHANGELOG*
- Migrated 5 leftover `onclick=` HTML attributes to `data-action`:
  - `cancel-reply` (line 415)
  - `submit-comment` (line 419)
  - `reset-all` (line 430)
  - `set-score` (line 453)
  - `clear-score` (line 454)
- Added a single delegated `document.addEventListener('click', …)` dispatcher
  (`index.html:1773`) keyed on `data-action`
- Migrated schedule pagination `prevBtn.onclick` / `nextBtn.onclick` to
  `addEventListener` (lines 1224 / 1236)
- Cached countdown + clock DOM nodes once into `cdNodes` / `clockNodes` constants
  (lines 774 / 781) — removes 14 `getElementById` calls/sec from the 1s intervals
- Fixed a stray duplicate `// CLOCK` block + duplicate `updateClock` definition
  that was created when an earlier edit landed in the middle of the previous copy
  (now lines 803–812 are a single clean block)
- Refreshed `PROGRESS.md` to 16 Jun, removed the stale "Pending Issues" list (all
  items remediated in `d3fbcd2`/`adabe91`), added a "Known Limitations / Future Work"
  section
- Added 16 Jun entry to `CHANGELOG.md`

### Verification
- `grep "onclick=\\|\.onclick\\s*=" index.html` → no matches
- The five `data-action` attributes all have corresponding cases in the new dispatcher
- The two `getElementById` lookups per interval are gone
- The duplicate `updateClock` is removed; the function is defined exactly once
- `server.js` and `firestore.rules` were not touched (deferred per user choice)

### Push flow
- Branch `cleanup/finish-onclick-migration` pushed to origin
- Later merged via PR #1 (commit `b558857`)

---

## Session 3 — Group Standings Tab (16 Jun 2026, branch `feature/group-standings-tab`)

User asked for a group standings table on the page. Confirmed via questions:
- **Where:** new tab (Schedule / Group Standings)
- **Calculation:** client-side from existing MATCHES + apiData
- **Qualify UI:** green tint + check mark (latter removed in session 4)
- **Layout:** grid of 12 small group cards

### Changes in commit `7b8c674` — *Add Group Standings tab*
- New `.tabs` / `.tab-btn` UI between the filters and the schedule (active state
  with gold underline, ARIA roles)
- New `<div class="tab-pane" id="schedule-pane">` and
  `<div class="tab-pane" id="standings-pane" style="display:none">` wrappers
- `GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']` const
- `computeStandings()` walks MATCHES + apiData; skips R32+ placeholders
  (`Winner`, `Runner-up`, `TBD`); falls back to a time-based "finished" check
  when the Gist hasn't reported a past match yet
- `buildStandingsHTML(groups)` renders 12 group cards with a compact table:
  Pos · Team · P · W · D · L · GF · GA · GD · Pts
- Sort order: Pts desc → GD desc → GF desc → name asc (standard FIFA tiebreak)
- `renderStandings()` runs on init, on tab switch, and on the smart refresh
  cycle (only when the Standings pane is visible)
- CSS appended to the existing `<style>` block (no new files):
  `.tabs`, `.tab-btn`, `.standings-grid`, `.group-card`, `.standings-table`,
  `.standings-empty`, `.qualify` row tint, `.prefers-reduced-motion` not
  addressed (still a low-priority TODO)
- Tab switching wired via `document.querySelectorAll('.tab-btn').forEach(…)`

### Verification
- Smoke test: all 17 expected DOM/JS/CSS markers present
- Math test (synthetic Group A): Mexico 9 pts (3W), top-2 ordering correct,
  goal diff correct
- `git status` clean after commit
- Branch pushed to origin as `feature/group-standings-tab`
- Later merged via PR #2 (commit `3056a3c`) and pulled into local main

---

## Session 4 — Remove Check Mark (16 Jun 2026)

User asked to drop the ✓ glyph from qualify rows.

### Changes in commit `55fa6f4` — *Remove check mark from qualify rows in group standings*
- Removed the one-line CSS rule:
  ```diff
  - .standings-table tr.qualify td.team strong::after { content: ' ✓'; color: var(--green); font-size: 11px; }
  ```
- The green row tint and the green position number stay — qualification is still
  obvious, just without the extra glyph

### Push flow
- `git push` initially rejected because remote had advanced (PR #2 merge)
- Rebased onto `origin/main` and re-pushed; final main HEAD is `1fd0ccd`

---

## Final State

### Git log (most recent first)
```
1fd0ccd Remove check mark from qualify rows in group standings
3056a3c Merge pull request #2 … (feature/group-standings-tab)
2e90727 Add Group Standings tab
7b8c674 Add Group Standings tab                    ← branch tip, now redundant
b558857 Merge pull request #1 … (cleanup/finish-onclick-migration)
d293f2d Finish onclick migration and clean up PROGRESS/CHANGELOG
adabe91 Security fixes: XSS hardening, server-side admin gate, auto-page to current matches
d3fbcd2 Security fixes, code deduplication, and performance improvements
…
```

### Working tree
Clean. All changes on `origin/main`.

### Branches that can be deleted
```bash
git push origin --delete feature/group-standings-tab
git push origin --delete cleanup/finish-onclick-migration
```

---

## Still Open (Deferred)

| # | Item | Effort | Why deferred |
|---|------|--------|--------------|
| 1 | Add `helmet` + `express-rate-limit` to `server.js`, especially around `/api/admin/*` | 15 min | User opted for "small fixes only" in session 2 |
| 2 | Tighten `firestore.rules` so `update` on `match_votes`/`champion_votes` cannot arbitrarily `set()` counts | 20 min | Same reason as #1 |
| 3 | Move score admin writes through a Cloud Function or transaction | 1–2 h | Today admin panel only updates local state, so risk is contained |
| 4 | Add `.gitignore` for `node_modules/` and `.env` | 1 min | Cosmetic |
| 5 | Add `Content-Security-Policy` header | 30 min | Tradeoff: requires nonces or `unsafe-inline` for the inline `<style>` block |
| 6 | Backfill `userId` on legacy comments so the delete button appears | 20 min | One-time migration |
| 7 | Best-3rd-place calculation (which 3rd-place teams from 8 groups advance to R32) | 1 h | Out of scope for "small fixes" |
| 8 | `escapeAttr` cleanup — drop the misleading backslash escapes | 5 min | Cosmetic; HTML attribute context doesn't honor JS-style `\'` |
| 9 | Refactor `buildCard` (130+ lines) into sub-helpers | 30 min | Readability only |
| 10 | `voteMatch` / `voteChampion` → use `runTransaction` | 30 min | Race in read-modify-write; tolerable for fun vote tally |
| 11 | Pause `scheduleRefresh` on `visibilitychange` | 15 min | Saves Gist calls in background tabs |
| 12 | `prefers-reduced-motion` for `.skeleton` shimmer | 5 min | A11y polish |
| 13 | Replace hardcoded Render URL with `location.origin` | 5 min | Cosmetic |

---

## Files Touched

| File | Sessions | Status |
|------|----------|--------|
| `index.html` | 2, 3, 4 | Modified — main app, all changes live |
| `PROGRESS.md` | 2 | Rewritten — reflects 16 Jun state |
| `CHANGELOG.md` | 2, 4 | Appended — 16 Jun "Cleanup Pass" + "Standings" + "Check mark" entries |
| `server.js` | — | Untouched |
| `firestore.rules` | — | Untouched |
| `package.json` | — | Untouched |
| `render.yaml` | — | Untouched |
| `README.md` | — | Untouched |
| `check_deploy.js` | — | Untouched |
| `.env.example` | — | Untouched |

---

## How to Roll Back

- **Drop the Standings tab entirely** (sessions 3 + 4):
  ```bash
  git revert 1fd0ccd 3056a3c 2e90727
  git push origin main
  ```
- **Drop the onclick→data-action migration** (session 2):
  ```bash
  git revert 1fd0ccd 3056a3c 2e90727 d293f2d
  git push origin main
  ```
- **Reset to last security-pass commit** (`adabe91`):
  ```bash
  git reset --hard adabe91
  git push --force origin main   # careful — rewrites remote history
  ```
- **Keep everything but restore the ✓ check mark** (session 4 only):
  ```bash
  git revert 1fd0ccd
  # then manually re-add to index.html:
  # .standings-table tr.qualify td.team strong::after { content: ' ✓'; color: var(--green); font-size: 11px; }
  git add index.html
  git commit -m "Restore check mark on qualify rows"
  git push origin main
  ```
