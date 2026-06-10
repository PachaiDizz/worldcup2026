# Football World Cup 2026 Matches - Development Log

## Project Overview
Single-file (`index.html`) dark-themed FIFA World Cup 2026 live scores & schedule tracker for Malaysian users (MYT/UTC+8). All 104 matches, live scores via football-data.org API, Firebase backend for votes/comments.

**Stack:** Vanilla HTML/CSS/JS, Firebase Firestore, football-data.org API, flagcdn.com flags

---

## Changes Made (11 Jun 2026)

### 1. Champion Vote Alignment Fix
- `.champ-btn` changed to flexbox column layout
- Flag + team name wrapped in `.ch-top` row for side-by-side alignment
- Added `.ch-name`, `.ch-flag`, `.ch-count` classes with proper `line-height` and `gap`
- Removed old `margin-bottom` from flag images

### 2. Vote Select/Deselect + Real-time Winrate
- `voteMatch()` now allows clicking the same vote again to **deselect**
- Deselect: removes from localStorage, decrements Firebase field
- Added `refreshVoteResult()` to force-update winrate immediately after deselect
- Fixed default percentages: was showing misleading 33/34/33 with 0 votes, now shows "—" and hides the bar
- All 3 vote result renderers (onSnapshot, renderVoteResult, loadAllVoteResults) updated

### 3. Official 48 Qualified Teams Update
**FLAGS** — added Jamaica (`"Jamaica":"jm"`)

**CHAMPION_CANDIDATES** — removed 8 non-qualified, added 2 missing:
- Removed: Italy, Serbia, Cameroon, Nigeria, Costa Rica, Wales, Denmark, Poland
- Added: Jamaica, Uzbekistan

**MATCHES (Group K)** — fixed 3 matches per official FIFA draw:
- Match 21: Portugal vs Jamaica (was DR Congo)
- Match 48: Colombia vs Jamaica (was DR Congo)
- Match 70: Jamaica vs Uzbekistan (was DR Congo)

### 4. Comment Delete Feature
- Generates unique `myUserId` on first visit, stored in `localStorage` (`wc26_uid`)
- Each comment stores `userId` field in Firebase
- `deleteComment()` deletes comment + child replies in a batch
- Red "🗑 Delete" button shows only on own comments/replies
- Added `.comment-delete-btn` and `.comment-actions` CSS

---

## Key File Locations in index.html

| Section | Lines |
|---------|-------|
| CSS styles | 8-291 |
| Firebase config | 419-432 |
| FLAGS object | 448-462 |
| API team name mapping | 470-482 |
| MATCHES array (all 104) | 487-592 |
| State variables | 597-610 |
| API fetching + auto-refresh | 642-721 |
| Countdown + Clock | 726-752 |
| Favourites | 757-771 |
| Reminders + ICS | 776-907 |
| buildCard() | 912-1024 |
| buildSchedule() | 1055-1149 |
| Match votes (Firebase) | 1176-1280 |
| Champion vote (Firebase) | 1363-1512 |
| Comments + delete | 1517-1625 |
| Init + onSnapshot listeners | 1630-1700 |
| Admin reset | 1705-1757 |

---

## Pending Items / Known Issues

### Security (from code review)
- **API key exposed** in client-side code (`fe60a460b0e145109061f8235801ed21`) — should use backend proxy
- **Firebase config exposed** — ensure Firestore security rules restrict writes
- **XSS in onclick attributes** — team names injected unsafely into `onclick` strings

### Bugs
- `.vote-result` CSS rules duplicated (lines ~246-255)
- `loadAllVoteResults()` is redundant with `onSnapshot` listener
- Match numbering in knockout rounds may be out of order
- Existing pre-update comments have no `userId` so delete button won't appear

### Improvements
- No favicon
- No Open Graph meta tags for social sharing
- ~1,325 lines of JS in single `<script>` — consider splitting
- Race conditions in Firebase vote writes (no transactions used)

---

## Git History
```
8cd244a  Add comment delete feature: users can delete own comments and replies
18fe101  Fix vote deselect: force refresh winrate to 0% immediately after deselect
e40e7e9  Update to official 48 qualified teams: add Jamaica, remove 8 non-qualified
268ee69  Champion vote: flag + team name in same row for equal height alignment
2331892  Fix champion vote flag-label alignment: wrap flag, match heights, flex gaps
eb29078  Fix champion button flag alignment + vote select/deselect support
3dab25d  Fix vote flicker: stop buildSchedule from wiping real-time onSnapshot updates
d44c923  Real-time Firestore listeners for votes, champion, and comments
```
