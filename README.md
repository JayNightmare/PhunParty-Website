
# PhunParty

Cozy indie trivia game. React + Vite + Tailwind frontend, Python backend API (`api.phunparty.com`). Host on desktop, join on mobile.

## Quick Start

1. `npm i`
2. `npm run dev`

## Build & Deploy

- `npm run build` produces `dist` for static hosting (e.g. GitHub Pages).
- CI/CD workflow deploys on pushes to `main`.

## Testing

- `npm run test` runs unit tests with Vitest.

## Game Modes

- **Easy:** No timer, multiple choice
- **Medium:** 30s timer, multiple choice
- **Hard:** 20s timer, free text

## Architecture

- **Frontend:** React, Vite, TailwindCSS
- **Backend:** Python REST API (`api.phunparty.com`)
- **API Client:** All game state, questions, sessions, and player actions are handled via backend endpoints in `src/lib/api.ts`.
- **Pages:** NewSession, Join, ActiveQuiz, ActiveSessions, PostGameStats, Account

## Features

- Host creates game sessions and controls quiz flow
- Players join via QR code or session link
- All state and questions are managed by backend API
- Live leaderboard and game stats

## Notes

- QR code encodes `#/join/:sessionId` for mobile join

## Contributing

PRs welcome! See `src/lib/api.ts` for backend integration details.