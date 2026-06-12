# Football World Cup 2026 Matches

A live scores and schedule tracker for the FIFA World Cup 2026™ with Malaysia Time (MYT) support.

## Features

- Live scores via GitHub Gist (Hermes bot updates via Telegram)
- All 104 matches from Group Stage to Final
- Countdown timer to next match
- WhatsApp sharing
- Match reminders (browser notifications or alert fallback)
- Favourite teams filter
- Search by team or venue
- **Scores embedded in team names** (e.g. "Mexico (2)") — no separate score box
- Real-time auto-refresh (30s for live matches, 5min otherwise)
- Responsive design

## Setup

1. Clone the repo
2. Open `index.html` in a browser
3. Or deploy to any static hosting (Render, Netlify, Vercel, etc.)

## Configuration

Set `GIST_URL` at the top of the `<script>` block in `index.html`:

```js
const GIST_URL = 'https://gist.githubusercontent.com/your-user/your-gist-id/raw/scores.json';
```

## Data

Scores are stored in a **GitHub Gist** JSON file. **Hermes** (Telegram bot) writes score updates to the Gist. The static site fetches from the Gist raw URL.

### Gist JSON format (keyed by match number)

```json
{
  "1": { "homeScore": 2, "awayScore": 1, "status": "FINISHED" },
  "3": { "homeScore": 1, "awayScore": 0, "status": "IN_PLAY", "minute": 67 }
}
```

Status values: `TIMED`, `IN_PLAY`, `PAUSED`, `FINISHED`

## Admin Panel (Manual Score Update)

1. Add `?admin=1` to the URL — e.g. `https://yoursite.com/?admin=1`
2. Scroll to the bottom of the page to find the **Manual Score Update** panel
3. Select a match, enter home/away scores, choose status (FT/Live/HT/Scheduled)
4. Click **Set Score** — the card updates immediately on screen
5. A JSON snippet is logged — send that to **Hermes** to persist to the Gist

## Score Display

Scores appear directly next to team names in gold:

```
[🇲🇽]                [🇿🇦]
Mexico (2)   FT   South Africa (0)
```

The center badge shows match status: `VS`, `LIVE`, `FT`, `HT`, `ET`, or `PEN`.

### Hermes — Telegram to Gist

Hermes calls the GitHub Gist API:

```
PATCH https://api.github.com/gists/{gist_id}
Authorization: Bearer {github_token}

{ "files": { "scores.json": { "content": "{...updated scores...}" } } }
```
