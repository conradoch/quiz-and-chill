# Quiz & Chill

Real-time multiplayer trivia for friends. Players join an ephemeral room by link or six-character code, answer the same questions simultaneously, and receive server-calculated points for accuracy and speed. One shared multiplayer engine powers distinct Standard and Football Night product entries.

Production: [quizandchill.fun](https://quizandchill.fun/)

## Current game format

| Stage | Questions | Difficulty | Maximum value each |
| --- | ---: | --- | ---: |
| Round 1 | 3 | Easy, non-niche | 1,000 |
| Round 2 | 3 | Medium, non-niche | 1,500 |
| Round 3 | 3 | Hard, non-niche | 2,000 |
| Final | 1 | Hard, preferably `isNiche=true` | 2,500 |

The provider explicitly seeks a tagged niche question for the final. If none is available, it silently uses a separate hard non-niche question; the game still starts and no question is reused within that game.

## Game modes and languages

- **Standard** lives at `quizandchill.fun`, keeps the existing English-only category experience, and loads questions server-side from The Trivia API.
- **Football Night** lives at `football.quizandchill.fun` (and `/football` for local/fallback access) with its own home, branding, and language selector. It uses a local bank of 258 bilingual football questions: 200 manually curated questions plus 58 deterministically generated from reviewed historical datasets.
- Both modes retain the same synchronized 3 Easy / 3 Medium / 3 Hard / 1 specialist Final structure and server-side scoring.
- Football question IDs and correct-answer indexes are shared across languages. Language changes copy only, so localization cannot alter the answer mapping.
- Football Night falls back to the full relevant difficulty pool after the fresh subset becomes too small, ensuring a room can always start. Server and host-browser history avoid repeats while sufficient fresh questions remain.
- Product mode is fixed by the entry hostname/path when a room is created. Joining by code still adopts the authoritative mode of the existing room, and copied invitations use that room's canonical product entry.

## Run locally

Requirements: Node.js 20 or later.

```bash
npm install
copy .env.example .env
npm run dev
```

Add the server-side API key to `.env` before starting. Never put the value in client code, documentation, screenshots, commits, or chat.

Open `http://localhost:3000` for Standard or `http://localhost:3000/football` for Football Night. For multiplayer QA, use separate browser profiles/windows. Other devices on the same network can use the host computer's LAN IP instead of `localhost`, subject to the local firewall.

Production-style start:

```bash
npm start
```

## Environment variables

Only names and purposes are documented:

- `TRIVIA_API_KEY`: paid The Trivia API credential, read only by `server.js`.
- `PORT`: HTTP port; Railway supplies this automatically. Local default is `3000`.

`.env*` is ignored except for the safe `.env.example` template. Railway stores `TRIVIA_API_KEY` as a service variable.

## Verification

```bash
npm test
npm run build
npm run validate:football
npm run football:check
```

`npm test` covers scoring, reveals, category mapping, difficulty progression, niche-final behavior, Football Night bilingual answer parity and editorial validation, session reuse, repeat protection, reconnect/leave flows, and key client regressions. `npm run validate:football` also checks that the generated module matches its source datasets; `npm run football:check` performs that drift check alone. `npm run build` validates required files and creates `dist/`; `dist/` is generated and ignored.

### Maintaining the Football Night bank

Historical facts live in `data/football/*.json`, separately from presentation code. Each collection records its official source and verification date; changing a dated title count also requires updating its explicit `asOf` cutoff. Facts marked `generate: true` produce bilingual multiple-choice rows with deterministic distractors and answer positions.

```bash
npm run football:generate
npm run validate:football
npm test
```

Commit the reviewed JSON facts and the regenerated `game/football-questions.generated.js` together. Do not hand-edit the generated module. The generator currently covers Ballon d'Or winners, Champions League winners and title counts, Copa Libertadores winners and title counts, and men's World Cup winners. Manual questions remain the right home for one-off facts that do not fit a reliable template.

Optional two-client Socket.IO smoke test (requires a server already running locally):

```bash
node tests/socket-smoke.mjs
```

## Question source and safety behavior

- `game/question-provider.js` is the server-side adapter for [The Trivia API](https://the-trivia-api.com/docs/).
- Requests retain the selected category, `contentFilter=family`, and global suitability by omitting `region`.
- The provider accepts only four-option `text_choice` questions, decodes HTML entities, shuffles answers, and withholds the correct answer until reveal.
- Rounds 1–3 reject `isNiche=true`; the final prefers a hard niche question discovered through a targeted tag request.
- The paid session is owned by the server. Browsers never receive the API key or choose the API session ID.
- Used question IDs are marked in the remote session. Server memory and recent browser history additionally reject exact IDs, normalized prompt matches, and strong token-level near-duplicates.
- Production calls `loadQuestions` with `allowLocalFallback: false`. API failure or insufficient data returns everyone to the lobby with a discreet service-unavailable message instead of silently serving the seed bank.
- `game/questions.js` remains a complete local seed bank for tests and explicit adapter fallback use, not the normal production path.

## Categories

The host can choose any number of topics for the room. `All categories` is exclusive: selecting it clears specific topics, while selecting a topic clears `All categories`. Guests see the complete grid in real time, including every selection change, but cannot edit it:

- All categories
- Science
- History
- Geography
- Entertainment
- Movies
- Music
- Sports
- Food & Drink
- General Knowledge

Mappings to API category identifiers live in `CATEGORY_OPTIONS` in `game/question-provider.js`. Selected identifiers are deduplicated and sent as one comma-separated The Trivia API filter. The provider chooses freely from the combined pool; the game does not guarantee that every selected topic appears in a ten-question match.

Football Night intentionally hides the Standard category grid because football is the room's complete question theme. Its selector and combined bank live in `game/football-questions.js`; generated source facts live under `data/football/`.

The desktop selector contains ten cards in a balanced five-by-two grid. It collapses to three and then two columns on narrower screens.

## Rooms, reconnect, and persistence

- Rooms, scores, players, timers, and the active API session live in process memory; there is no database or account system.
- The browser stores only anonymous room/player resume data and up to 300 recent question IDs/prompts in `localStorage`.
- Reloading or reconnecting resumes the same player while the room still exists.
- If the host stays offline for 15 seconds, host control moves to a connected player.
- A completely disconnected room is deleted after 5 minutes. An explicit last-player leave deletes it immediately.
- `Play again` returns the same room and players to the lobby, resets scores, and keeps the selected category.
- Multiple Railway replicas are not currently supported because Socket.IO rooms are in-memory and there is no shared adapter/sticky-session design.

For first-time visitors, music is enabled at 50%. Existing visitors keep their saved global mute, music-only mute, and music-volume preferences. The client attempts playback immediately and retries on the first pointer or keyboard interaction when browser autoplay policy blocks it.

## Deployment and publishing

Railway is connected to GitHub repository `conradoch/quiz-and-chill`, branch `main`, and serves `quizandchill.fun`. The intended second custom domain is `football.quizandchill.fun`, pointed at the same Railway service. Auto-deploy should remain enabled. Railway must have `TRIVIA_API_KEY`; do not manually define `PORT` unless Railway requires it.

Safe release sequence:

```bash
git status --short
npm test
npm run build
git diff --check
git diff -- . ':!public/audio/*'
git add -- <intentional files only>
git diff --cached
git commit -m "Describe the change"
git push origin main
```

Then confirm Railway deployed that commit, inspect sanitized deploy logs, open `/health`, and run a two-client game on the production URL. Never commit `.env`, API keys, logs, temporary attachments, `node_modules/`, or generated `dist/`.

For architecture, event flow, operational limits, and a future-session checklist, see [docs/HANDOFF.md](docs/HANDOFF.md).

## Credits and license notes

Quiz & Chill is a free, non-commercial project created by Conrado Chaves with AI assistance. Trivia questions come from The Trivia API under its stated Creative Commons Attribution-NonCommercial 4.0 terms. The in-app credits dialog contains the public attribution. Background music is an original track supplied by the project creator.
