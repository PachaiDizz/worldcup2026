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
- Responsive design

## Setup

1. Clone the repo
2. Open `index.html` in a browser
3. Or deploy to any static hosting (Render, Netlify, Vercel, etc.)

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

### Hermes — Telegram to Gist

Hermes calls the GitHub Gist API:

```
PATCH https://api.github.com/gists/{gist_id}
Authorization: Bearer {github_token}

{ "files": { "scores.json": { "content": "{...updated scores...}" } } }
```
