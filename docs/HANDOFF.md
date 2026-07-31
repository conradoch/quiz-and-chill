# Quiz & Chill: architecture and handoff

This document is the source of truth for a future Codex session starting without conversation history. Read it together with the current diff and tests; code remains authoritative if this document becomes stale.

## 1. System overview

- Runtime: Node.js 20+, Express 5, Socket.IO 4, browser-native HTML/CSS/JavaScript.
- Entry point: `server.js`.
- Client: `public/index.html`, `public/app.js`, `public/audio.js`, `public/styles.css`.
- Game logic: `game/engine.js`, `game/session.js`, `game/questions.js`.
- External-question adapter: `game/question-provider.js`.
- State: one Node process, entirely in memory; no accounts or database.
- Hosting: Railway from GitHub `conradoch/quiz-and-chill` / `main`; custom domain `quizandchill.fun`.

The server is authoritative for room membership, phase timers, selected question bank, correct answers, scoring, leaderboard, host transfer, and game completion. The client renders `room:state` and sends intent events only.

## 2. Room and game state machine

```text
lobby -> loading -> question -> reveal
                     ^           |
                     |-----------|
                     |
                 transition (before indexes 3, 6, and 9)
                     |
                  finished -> lobby (Play again)
```

- All connected players receive the same server timestamps and questions.
- A question reveals early when every connected player answered, otherwise at the server deadline.
- Correct indices/text appear only in per-player reveal state.
- Scoring is server-side: a correct answer earns 50–100% of value based on elapsed time; incorrect/invalid answers earn zero.
- The final is worth 2,500 and cannot outweigh all earlier questions by itself.

## 3. The Trivia API integration

### Credential boundary

`server.js` loads `.env` with `process.loadEnvFile` and reads `TRIVIA_API_KEY`. The value is passed directly to `loadQuestions` and becomes the `x-api-key` header. Never move it into `public/`, Socket.IO state, URLs, logs, tests, docs, or commits.

Environment variable names only:

- `TRIVIA_API_KEY`
- `PORT`

### Main request flow

1. `server.js` owns one `activeTriviaSessionId` for the process.
2. With a key and no session, `POST /v2/session` creates one.
3. General candidates come from `GET /v2/session/{id}/preview-questions` with `limit=50`, selected `categories`, missing `difficulties`, `contentFilter=family`, no `region`, and cache-busting/no-cache controls.
4. The provider collects 3 easy, 3 medium, and 4 hard non-niche questions. Three hard questions form Round 3; one remains a distinct final fallback.
5. Any hard niche candidate is held only for index 9.
6. If needed, `/v2/tags` supplies hard tags; tagged hard previews make niche questions eligible. Only `isNiche=true` is accepted on this path.
7. Order is Easy x3, Medium x3, Hard non-niche x3, Hard niche x1. If niche discovery fails, the reserved hard non-niche question becomes index 9.
8. `POST /v2/session/{id}/questions` marks only the ten staged IDs used.
9. A 400/401/403/404 from an inherited session causes one replacement session and retry.

### Validation and category behavior

- Accept only `text_choice` with a prompt and exactly three incorrect answers.
- Rounds 1–3 always reject `isNiche=true`.
- All categories spreads topics; its easy opening also passes the party-friendly filter.
- A selected category applies to both general and niche-final requests.
- Requests remain family-filtered and globally suitable (no `region`).
- Prompts/answers are HTML-decoded, answers shuffled, and normalized questions retain `difficulty`/`isNiche` metadata.

### Repeat protection

1. The remote session excludes marked IDs while that session remains active.
2. `recentQuestionHistory` stores up to 200 server-process entries.
3. The host browser sends up to 300 recent `{id,prompt}` records, sanitized by `cleanRecentQuestions`.

History rejects matching IDs, normalized prompt fingerprints, and near-duplicates with at least 85% meaningful-token overlap. A Railway restart loses server memory/session ID, but the returning host's browser history still helps. Different devices have independent browser histories. Durable global guarantees would require Redis/Postgres.

### Failure policy

Production uses `allowLocalFallback: false`. Unrecoverable API failure or fewer than ten valid questions returns the room to lobby with a discreet service-unavailable message. The seed bank in `game/questions.js` is for tests or explicit fallback calls, never silently mixed into production. Failure to find a niche final is different: the separate API-sourced hard non-niche reserve is the intentional internal fallback and does not interrupt play.

## 4. Categories

`CATEGORY_OPTIONS` is the mapping source. Current keys:

```text
all
science
history
geography
entertainment
movies
music
sports
food-and-drink
general-knowledge
```

Only the host can emit `category:set` in lobby. Guests see it read-only. `Play again` retains `categoryKey` while resetting scores/game state.

## 5. Identity, reconnect, and leaving

- Browser `localStorage` key `quiz-and-chill-session` stores anonymous `{code, playerId, name}`.
- Reload/reconnect emits `room:resume` and reattaches identity if the room/player still exists.
- Presence notices cover join, disconnect, return, leave, restart, winner, and host transfer.
- A disconnected host transfers control after 15 seconds.
- A fully disconnected room expires after 5 minutes.
- Explicit leave removes the player immediately; one remaining player wins an active match.
- Logo/Leave game opens confirmation. Finished-screen Back to home explicitly leaves and clears local room state.
- Host-only Play again resets scores/answers while preserving code, players, and category.

State is single-process. Keep Railway at one replica until shared state, a Socket.IO adapter, and routing strategy exist.

## 6. Client, audio, and cache behavior

- HTML/JS/CSS use `Cache-Control: no-store, max-age=0`.
- Bump asset query versions in `public/index.html` if browser caching could hide a client release.
- Answer selection updates only option DOM state to avoid whole-question flicker.
- First-time users start with music enabled at 50%; existing saved mute/volume preferences win. Playback is attempted immediately, then retried on the first pointer or keyboard interaction if autoplay policy blocks it.
- The visible linear 0â€“100% music slider remains unchanged and still defaults to 50% for new users, but the track's effective `MUSIC_BASE_GAIN` is 0.18 across the full curve (25/50/100% target 0.045/0.09/0.18 before scene ducking). The effects bus is slightly forward at 0.86 and still feeds the compressor. This proportional rebalance is intentional so approved effects remain clear without becoming aggressive. Reveal/transition/loading scene multipliers continue to duck the track further.
- Web Audio effects unlock after interaction. Global Sound controls effects/music; Music and volume apply independently and persist locally.
- Current music: `public/audio/points-on-the-board.mp3`.
- Leaving through Back to home or Leave game is an in-page state transition: the client emits `room:leave`, clears anonymous room state, replaces the URL with `/`, restores the cached home markup, and keeps the same `ChillAudio`/HTMLAudioElement alive. Do not reintroduce `location.replace` or a reload here; continuous music is intentional.
- Effects use an original modern Web Audio palette: clean additive sine mallets (`resonantMallet`) and warm, spaced mallet arpeggios (`softArpeggio`) through a compressor. There are no square waves, sustained triangle/unison pads, generated noise/percussion buffers, or pitch ramps. The nearly dry spatial send is 65 ms with 1.8% wet and 2% feedback.
- Selection is one short mallet. Correct, level transition, and final use rounded arpeggios. Incorrect is a short low dyad. Rank-up is a clean dyad. Start is a longer low body plus warm three-note arpeggio.
- The visual countdown is authoritative. Audio ticks are intentionally limited to `phase === "transition"`, so 3â€“2â€“1 is heard only before Round 2, Round 3, and the Final. Ordinary reveals between questions and the final seconds of answer time are silent. Transition ticks occur as the displayed value changes, approximately one second apart, and grow from 220 to 246.94 to 293.66 Hz with 180/210/250 ms decays. `start()` fires on every actual transition into `phase === "question"`, after any visual countdown and when the new question appears.
- Valid Create room and lobby Start game activations have separate short confirmation cues (`createRoom()` and `lobbyStart()`). Create room stays silent when client-side name validation fails. These button cues are deliberately shorter than `start()`, so they are not confused with the fuller beginning-of-question resolution.
- No Sound check button/modal/handlers/styles or preview-only scheduler ships in the public UI; the temporary QA panel and its helper were intentionally removed before release.
- Reveal feedback is a compact horizontal strip: Correct/Incorrect, the correct answer, and earned points. The lower post-question leaderboard remains the regular leaderboard and was not compacted.
- During reveal only, each answer option displays overlapping initial badges for every player who selected it. The server emits `answerMarkers` only in `room.reveal`; never expose it in the live question phase, or it would spoil answers before time expires.

## 7. Verification and manual QA

```bash
npm install
npm test
npm run build
```

With a server running, `node tests/socket-smoke.mjs` verifies create/join/disconnect/resume using two clients.

Manual checklist:

1. Validate empty and valid player names.
2. Create/join through a copied room URL in two browser profiles.
3. Verify host category edits and guest read-only state.
4. Confirm 3 Easy, 3 Medium, 3 Hard, then Final question.
5. Confirm no niche marker in indexes 0–8; show specialist marker only for a niche final.
6. Test correct/incorrect answers and all option indexes, especially index 0.
7. Reload and reconnect; confirm identity/score and presence notices.
8. Test explicit leave, last-player win, Play again, and Back to home.
9. Test sound/music controls and mobile layout.
10. Watch a reveal countdown: verify visual/audio 3, 2, 1 at one-second intervals and the fuller Start cue exactly as the next question appears.

## 8. Railway deployment

Intended configuration:

- Source: GitHub `conradoch/quiz-and-chill`
- Branch: `main`
- Start: `npm start`
- Service variable: `TRIVIA_API_KEY`
- Platform variable: `PORT`
- Domain: `quizandchill.fun`
- One replica; auto-deploy enabled

Release procedure:

1. Inspect status/diff and run tests, build, and `git diff --check`.
2. Check tracked/untracked candidates for secrets without printing values.
3. Stage intentional paths only; inspect `git diff --cached`.
4. Commit/push only with explicit authorization.
5. Confirm Railway deployed that commit. Variable changes may require clicking Redeploy.
6. Check `https://quizandchill.fun/health` and a two-client production game.

Do not expose the Railway project itself just to expose the web service. Never place secrets in logs, client bundles, GitHub Actions, screenshots, or issues.

## 9. Safe Git/publication checklist

```bash
git status --short --branch
git diff --check
git diff
git diff --cached
git ls-files
```

Confirm `.env`, attachments, logs, caches, `node_modules`, and `dist` are excluded. Avoid broad staging when unrelated user files exist. Never discard user changes without authorization.

## 10. Known limits and next work

- Rooms and API session state disappear on restart.
- One replica only; no durable shared state.
- No accounts, moderation, analytics, or strong anti-cheat.
- Spanish requires The Trivia API Complete translations and a language-aware request path. The app is currently English-only.
- The dedicated session preview endpoint used for English does not document `language`; verify plan and endpoint behavior before adding a selector.
- Durable global repeat prevention would benefit from Redis/Postgres IDs/fingerprints with retention.

### Current published state (2026-07-31)

The final client/audio iteration is published on `main` in commit `7c37c68` (`Refine audio cues and mix balance`). The working tree was clean and synchronized with `origin/main` immediately after publication. This release includes continuous music on home return, the compact reveal strip, modern dry effects, synchronized countdown/Start triggers, valid Create room and Start game confirmation cues, the revised music/effects mix, asset cache-version bumps, and regression coverage. The removed Sound check was QA-only and must not be restored to production unless explicitly requested as a development-only tool.

## 11. Future Codex startup checklist

```bash
git status --short --branch
git log --oneline --decorate -10
git rev-list --left-right --count origin/main...HEAD
npm test
```

Then read `README.md`, this file, `game/question-provider.js`, and relevant tests. Verify API assumptions against current official docs. Never reveal `.env`; checking that `TRIVIA_API_KEY` exists and is non-empty is sufficient. Do not push or trigger Railway without explicit authorization.

