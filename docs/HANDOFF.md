# Quiz & Chill: architecture and handoff

This document is the source of truth for a future Codex session starting without conversation history. Read it together with the current diff and tests; code remains authoritative if this document becomes stale.

## 1. System overview

- Runtime: Node.js 20+, Express 5, Socket.IO 4, browser-native HTML/CSS/JavaScript.
- Entry point: `server.js`.
- Client: `public/index.html`, `public/app.js`, `public/audio.js`, `public/styles.css`.
- Game logic: `game/engine.js`, `game/session.js`, `game/questions.js`.
- External-question adapter: `game/question-provider.js`.
- Curated bilingual football adapter/bank: `game/football-questions.js`, with reviewed structured facts under `data/football/` and deterministic output in `game/football-questions.generated.js`.
- State: one Node process, entirely in memory; no accounts or database.
- Hosting: Railway from GitHub `conradoch/quiz-and-chill` / `main`; custom domain `quizandchill.fun`.

The server is authoritative for room membership, phase timers, selected question bank, correct answers, scoring, leaderboard, host transfer, and game completion. The client renders `room:state` and sends intent events only.

### Game modes and language ownership

- Standard and Football Night are separate product entries backed by the same client/server engine. `quizandchill.fun` fixes new rooms to Standard; `/football` fixes them to Football Night. The client is also ready to recognize `football.quizandchill.fun`, but that hostname is not active because the current Railway Trial plan allows only one custom domain.
- A room is created with immutable `gameMode` (`standard` or `football`) and `language` (`en`, or `es` for Football Night only).
- Standard remains English-only and preserves The Trivia API/category flow.
- Football Night is available in English and Spanish. Spanish is the default for a visitor with no saved choice; an explicit English/Spanish home selection is persisted under the browser key `quiz-and-chill-football-language`. The host chooses language before creating the room, and guests inherit it through authoritative room state.
- `roomView` exposes sanitized mode/language labels. Reconnect and Play again preserve both fields.
- The client sets `document.documentElement.lang` and localizes lobby, transitions, question/reveal status, final results, presence notices, header controls, and leave confirmation for Spanish Football Night rooms.
- `PRODUCT_MODE` in `public/app.js` derives the entry product from a `football.` hostname or `/football` path. The legacy Standard/Football mode-card markup has been removed from `public/index.html`, so it cannot flash before JavaScript locks the product. A tiny inline pre-paint script applies the Football dataset before decorative content renders; Standard removes the football-only language control after startup. A discreet cross-product link remains available.
- Football Night's English/Español control is a prominent bar above the hero. Changing it immediately translates the complete visible home flow (hero, proof points, labels, placeholders, room actions, validation copy, audio controls, metadata, credits link, and product switch) and sets the document language/title; room creation then sends that same locale to the server. The shorter bilingual hero copy and side-by-side mobile actions keep both primary buttons visible on narrow screens.
- Joining an existing room remains authoritative: a room can be joined from either entry and `room:state` applies its real mode/language. `roomInviteUrl` points Football Night links to `/football` on the current origin until a public football subdomain is active; a future `football.` hostname is already recognized and keeps links on that origin.

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

Football Night does not expose this category picker. Its lobby shows the fixed Football Night format and room language instead, and the server rejects `category:set` for football rooms.

## 4.1 Football Night question bank

- Football Night currently exposes 317 active bilingual questions: 182 eligible manual questions plus 135 questions deterministically generated from reviewed historical datasets. The current source pools are 57 Easy, 110 Medium, 127 Hard non-niche, and 23 Hard niche finals. The launch/first expansion lives in `game/football-questions.js`; the second manual batch lives in `game/football-question-expansion.js`; generated rows live in `game/football-questions.generated.js`. All use the same `q(...)` contract.
- Each record stores paired English/Spanish category, prompt, and option text plus one language-independent `correctIndex`. Tests assert identical IDs and correct indexes across languages.
- Football IDs are deterministic hashes of the English prompt, not array positions. Reordering the editorial file therefore cannot invalidate recent-question history. Editing a prompt intentionally creates a new ID, while prompt fingerprints still protect old wording already stored by a browser.
- `npm run validate:football` runs the editorial gate in `scripts/validate-football.mjs`. It rejects missing translations, invalid difficulty/niche combinations, bad or repeated options, invalid correct indexes, ID collisions, duplicate prompts, high-similarity prompts with the same answer, insufficient progression pools, and generated-output drift.
- The original source-Easy pool is deliberately retired from live play because it overrepresented elementary rules, kit colors, club countries, stadiums, and organizations. `loadFootballQuestions` now exposes the intended 3 Easy / 3 Medium / 3 Hard / 1 niche-final progression while sourcing Round 1 from a restricted Medium pool of recognizable history, awards, and major competitions; Rounds 2–3 source six distinct Hard questions, and the final remains Hard niche. The difficulty exposed to the client still matches the scoring curve.
- The existing combined process/browser `RecentQuestionHistory` is reused. Selection first prefers IDs and wording that are both fresh, then unused IDs even when similarly phrased historical questions exist, and only reopens a full difficulty bucket when it truly lacks enough unused IDs. Played IDs are always recorded even when their prompts resemble another played question. The regression suite proves that the current distribution can stage twenty complete 10-question games (200 selections) without repeating an ID.
- Women's-football records remain visible in the editorial source file for audit/history but are filtered out of the active bank before validation, statistics, and selection. Regression coverage samples twenty games in both progression/repeat tests and rejects English or Spanish women's-football output.
- This bank does not call The Trivia API or a translation provider at runtime, requires no new environment variable, and therefore keeps Spanish available without upgrading to The Trivia API Complete.
- Editorial policy: favor stable facts and official references, including FIFA tournament history, UEFA competition history, France Football's Ballon d'Or palmarès, CONMEBOL competition history, and IFAB Laws of the Game. Manual additions still require paired copy, four aligned options, and a tested correct index.

### Structured football fact pipeline

- `data/football/historical-winners.json` stores Ballon d'Or, Champions League, Copa Libertadores, and men's World Cup winner histories. `data/football/title-counts.json` stores dated Champions League and Libertadores title totals. Each collection carries an official source URL and `verifiedAt`; mutable totals also carry bilingual `asOf` wording that is rendered into the question.
- A fact only becomes a question when it is explicitly marked `generate: true`. The active generated coverage now includes all 69 European Cup/Champions League seasons from 1955–56 through 2023–24, all 25 Copa Libertadores editions from 2000 through 2024, and 24 awarded Ballon d'Or years from 2000 through 2024; reviewed histories also remain available as controlled distractor pools.
- `scripts/generate-football.mjs` validates the data schema, chooses unique same-competition winners near the target season for plausible era-aware distractors, places the answer deterministically, produces aligned English/Spanish rows, and writes `game/football-questions.generated.js`. Pre-1992 prompts correctly say European Cup/Copa de Europa. It does not make network requests at build or game time.
- Run `npm run football:generate` after editing facts. Run `npm run football:check` to fail when the checked-in output is stale; `npm run validate:football` includes the same drift gate plus the full editorial validator. Never edit the generated module by hand.
- Current generated scope is deliberately Medium/Hard. Recent major-trophy winners seed the broad-interest opening pool, while older winners stay Hard; specialist niche finals remain manually curated until a fact template can guarantee that the result is genuinely specialist rather than merely obscure.
- This is a migration path toward a database, not a runtime database dependency: facts are reviewable in Git, gameplay remains fast and offline-capable, and the public client never receives provenance metadata or credentials.

## 5. Identity, reconnect, and leaving

- Browser `localStorage` key `quiz-and-chill-session` stores anonymous `{code, playerId, name}`.
- Reload/reconnect emits `room:resume` and reattaches identity if the room/player still exists.
- Home `Create room` and `Join` are guarded connection operations rather than fire-and-forget emits. The client waits up to 20 seconds for Socket.IO connectivity, then gives the acknowledged room action 10 seconds; it disables/labels the active button while pending and restores it with a localized retry message after a true timeout. Railway was observed returning intermittent `502` responses on Engine.IO polling, so the browser now tries WebSocket first, retains polling as fallback, and does not treat the first `connect_error` as terminal while Socket.IO is retrying. The server treats a repeated create on an already attached socket as idempotent and returns that room, preventing rapid taps or delayed packets from leaking orphan rooms. A repeated join for the same socket/player/room is likewise idempotent.
- `room:leave` accepts both callback-only and `(payload, callback)` Socket.IO call shapes and verifies callback types before invoking them. This is a process-safety boundary: malformed/unexpected client packets must not throw an uncaught `TypeError` and take down the single Railway process.
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
- While a question remains live, subsequent `room:state` broadcasts preserve the existing question-stage and timer DOM so another player's answer cannot replay entrance animations or flash the prompt. `syncLiveQuestionState` still refreshes the horizontal scoreboard (including connection state) and the local answer lock; presence toasts and header state are updated before that targeted path returns.
- The question timer bar initializes from the authoritative server `phaseEndsAt` on every render and clamps progress to 0–100%. It must never reset to a hard-coded 100% during same-question `room:state` broadcasts (for example, when another player answers), because that produces visible fill/empty flicker online.
- First-time users start with music enabled at 50%; existing saved mute/volume preferences win. Playback is attempted immediately, then retried on the first pointer or keyboard interaction if autoplay policy blocks it. The MP3 uses `preload="metadata"`, not `auto`, so its multi-megabyte payload does not compete with the initial HTML/JS/Socket.IO connection on mobile; the first permitted playback fetches it as needed.
- The visible linear 0â€“100% music slider remains unchanged and still defaults to 50% for new users, but the track's effective `MUSIC_BASE_GAIN` is 0.18 across the full curve (25/50/100% target 0.045/0.09/0.18 before scene ducking). The effects bus is slightly forward at 0.86 and still feeds the compressor. This proportional rebalance is intentional so approved effects remain clear without becoming aggressive. Reveal/transition/loading scene multipliers continue to duck the track further.
- Web Audio effects unlock after interaction. Global Sound controls effects/music; Music and volume apply independently and persist locally.
- Current music: `public/audio/points-on-the-board.mp3`.
- Leaving through Back to home or Leave game is an in-page state transition: the client emits `room:leave`, clears anonymous room state, removes the room query while preserving the current product path, restores the cached home markup, and keeps the same `ChillAudio`/HTMLAudioElement alive. Do not reintroduce `location.replace` or a reload here; continuous music is intentional.
- Product-specific home state is cached only after `configureProductHome` has removed the irrelevant language control from Standard and applied the correct hero. Leaving a room therefore returns to the same product entry without reloading or interrupting music. On local `/football`, the path remains `/football`.
- The cached product home contains no legacy mode cards. Returning from a room reapplies `homeLanguage`, so a Football Night player who selected Spanish returns to the translated Spanish home without reloading the audio engine.
- Effects use an original modern Web Audio palette: clean additive sine mallets (`resonantMallet`) and warm, spaced mallet arpeggios (`softArpeggio`) through a compressor. There are no square waves, sustained triangle/unison pads, generated noise/percussion buffers, or pitch ramps. The nearly dry spatial send is 65 ms with 1.8% wet and 2% feedback.
- Selection is one short mallet. Correct, level transition, and final use rounded arpeggios. Incorrect is a short low dyad. Rank-up is a clean dyad. Start is a longer low body plus warm three-note arpeggio.
- The visual countdown is authoritative. Audio ticks are intentionally limited to `phase === "transition"`, so 3â€“2â€“1 is heard only before Round 2, Round 3, and the Final. Ordinary reveals between questions and the final seconds of answer time are silent. Transition ticks occur as the displayed value changes, approximately one second apart, and grow from 220 to 246.94 to 293.66 Hz with 180/210/250 ms decays. `start()` fires on every actual transition into `phase === "question"`, after any visual countdown and when the new question appears.
- Valid Create room and lobby Start game activations have separate short confirmation cues (`createRoom()` and `lobbyStart()`). Create room stays silent when client-side name validation fails. These button cues are deliberately shorter than `start()`, so they are not confused with the fuller beginning-of-question resolution.
- No Sound check button/modal/handlers/styles or preview-only scheduler ships in the public UI; the temporary QA panel and its helper were intentionally removed before release.
- Reveal feedback no longer renders a result card or a second leaderboard below the options. Correct answers remain green, a wrong selection remains red, and each option still carries its reveal label/answer markers. The authoritative horizontal standings row now owns score feedback: a positive local award briefly animates as `↗ +N` over the player's row while the updated total pulses; zero-point answers show no misleading award. The next-question countdown shares the existing top metadata row, so reveal adds no vertical panel below the answers. Live and reveal deliberately share the exact same question/options spacing; do not add reveal-only mobile compression, because it creates a visible layout jump. On mobile the common question wrapper fills at least the viewport below the 72px header, keeping the relative creator credit below the initial game screen.
- Live standings use an almost-opaque product-colored surface (indigo in Standard, deep green in Football Night). This is intentional: the fixed crescent moon can sit geometrically behind the right side of a row, but it must never reduce contrast of the score total.
- During reveal only, each answer option displays overlapping initial badges for every player who selected it. The server emits `answerMarkers` only in `room.reveal`; never expose it in the live question phase, or it would spoil answers before time expires.
- `body[data-game-mode]` owns visual theming. Standard retains the indigo city skyline. Football Night retains the moon/brand but swaps in a dark green, floodlit CSS-only stadium and pitch; no external image asset is required.
- The home mode cards preview the corresponding theme. Football Night uses a clearly recognizable football glyph rather than an abstract dot mark and reveals an English/Español toggle; joining by room code ignores the joiner's home selection and adopts the existing room's mode/language.

## 7. Verification and manual QA

```bash
npm install
npm test
npm run build
npm run validate:football
npm run football:check
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
11. Create Standard and Football Night rooms separately. Confirm Standard has ten category cards and stays English.
12. Create Football Night in both English and Español. Confirm the lobby, questions/options, reveals, transitions, final screen, notices, leave dialog, and reconnect state use the room language.
13. At 390px width, confirm the Football language bar and side-by-side room actions remain reachable, questions use one-column options, and there is no horizontal overflow.
14. Open `/` and `/football` independently. Confirm Standard has no product-mode chooser, Football Night has only its language selector, their cross-links point to each other, and copied room links retain the room's product entry.
15. Reload `/` with a throttled/slow client and confirm the former Standard/Football chooser never flashes. On `/football`, switch English/Español before creating a room and confirm all visible home controls/copy change immediately, both action buttons remain side by side at 390px, and there is no horizontal overflow.

## 8. Railway deployment

Intended configuration:

- Source: GitHub `conradoch/quiz-and-chill`
- Branch: `main`
- Start: `npm start`
- Service variable: `TRIVIA_API_KEY`
- Platform variable: `PORT`
- Domain: `quizandchill.fun`
- Desired second custom domain: `football.quizandchill.fun` on the same service/port; currently blocked by the Railway Trial plan's one-custom-domain limit
- One replica; auto-deploy enabled
- The HTTP/Socket.IO server binds explicitly to `0.0.0.0` on Railway's injected `PORT`.

Release procedure:

1. Inspect status/diff and run tests, build, and `git diff --check`.
2. Check tracked/untracked candidates for secrets without printing values.
3. Stage intentional paths only; inspect `git diff --cached`.
4. Commit/push only with explicit authorization.
5. Confirm Railway deployed that commit. Variable changes may require clicking Redeploy.
6. Check `https://quizandchill.fun/health` and a two-client production game.

The production code already supports the Football Night subdomain. Railway rejected adding `football.quizandchill.fun` on 2026-08-01 because the Trial plan's only custom-domain slot is occupied by `quizandchill.fun`. Until the plan/domain limit changes, use `https://quizandchill.fun/football`. If a second domain slot becomes available, add `football.quizandchill.fun` under the same service's Public Networking settings and create the exact CNAME/TXT records Railway supplies. Do not create a second Railway service: rooms are in-memory and both products must reach the same Node process.

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
- Spanish is currently supported only in Football Night through the paired local bank. Standard Spanish would still require a separate translation/provider strategy; The Trivia API's native language parameter requires its Complete plan.
- Football Night's 317-question active bank substantially delays repetition but is still finite. Extend the structured fact datasets for template-friendly history and keep one-off editorial questions manual. Move to a curated database when non-developers need to manage the catalogue or the JSON review flow becomes unwieldy.
- Invitation links carry the room code and host display name. On an invite URL, the home view becomes a dedicated join screen: it hides Create room, locks the invited room code, asks only for the player's name, presents Join this room, and offers Back to home. Older invite links without a host name still use the same dedicated join flow with generic copy.
- The Standard mobile home is deliberately compact: its short headline and reduced vertical spacing keep the entry card and its primary action visible without scrolling on typical phone screens. Keep Football Night's separate mobile typography intact.
- Next Football Night editorial priority: add source-verified bilingual questions about Argentine/domestic-league history and historic top scorers, and add controlled within-game category diversity if the expanded winners templates begin to overrepresent Champions League in a single match. Keep the mode demanding rather than weakening a round merely to fill it.
- Durable global repeat prevention would benefit from Redis/Postgres IDs/fingerprints with retention.

### Current published state (2026-08-01)

Commit `7582507` ("Harden production connectivity") is the current published `origin/main` baseline. It includes Spanish-by-default Football Night, the 317-question Football bank/harder progression, stable mobile reveal geometry, opaque standings over the moon, and the production reliability fix: WebSocket-first transport with polling fallback, retry-tolerant 20-second connection waiting, separate 10-second action acknowledgements, deferred music preloading, safe handling of both `room:leave` packet shapes, and explicit `0.0.0.0` binding. `quizandchill.fun` is the Standard entry and `https://quizandchill.fun/football` is the Football Night entry; the intended `football.quizandchill.fun` entry is code-ready but blocked by the current Railway Trial custom-domain limit. Post-deploy production QA on 2026-08-01 verified the new versioned client asset, four create/leave cycles alternating Standard and Spanish Football Night at about 1.25 seconds each, no connection errors, `/health` 200, and zero residual rooms. The release retains deterministic prompt IDs, ID-first repeat protection, the editorial validator, continuous music on home return, modern dry effects, synchronized countdown/Start triggers, asset cache-version bumps, multiplayer timer-flicker protection, and targeted same-question state synchronization. The removed Sound check was QA-only and must not be restored to production unless explicitly requested as a development-only tool.

## 11. Future Codex startup checklist

```bash
git status --short --branch
git log --oneline --decorate -10
git rev-list --left-right --count origin/main...HEAD
npm test
```

Then read `README.md`, this file, `game/question-provider.js`, and relevant tests. Verify API assumptions against current official docs. Never reveal `.env`; checking that `TRIVIA_API_KEY` exists and is non-empty is sufficient. Do not push or trigger Railway without explicit authorization.

