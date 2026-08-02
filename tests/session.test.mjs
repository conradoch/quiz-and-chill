import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rankPlayers, resetPlayersForReplay, shouldFinishAfterLeave } from "../game/session.js";

test("play again resets scores and answer state while preserving players", () => {
  const players = new Map([
    ["host", { id: "host", name: "Host", score: 4200, answered: true, connected: true }],
    ["guest", { id: "guest", name: "Guest", score: 2100, answered: true, connected: false }],
  ]);
  resetPlayersForReplay(players);
  assert.equal(players.size, 2);
  assert.deepEqual(
    [...players.values()].map(player => ({ name: player.name, score: player.score, answered: player.answered, connected: player.connected })),
    [
      { name: "Host", score: 0, answered: false, connected: true },
      { name: "Guest", score: 0, answered: false, connected: false },
    ],
  );
});

test("finished screen returns home without reloading or interrupting music", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);

  assert.match(client, /id="go-home"/);
  assert.match(client, /BACK TO HOME/);
  assert.match(client, /localStorage\.removeItem\(SESSION_KEY\)/);
  assert.match(client, /socket\.emit\("room:leave", showHome\)/);
  assert.match(client, /history\.replaceState\(null, "", location\.pathname\)/);
  assert.match(client, /app\.innerHTML = homeMarkup/);
  assert.match(client, /chillAudio\.setScene\("home"\)/);
  assert.doesNotMatch(client, /location\.replace\(/);
  assert.match(client, /brandLink\.onclick/);
  assert.match(server, /socket\.on\("room:leave"/);
});

test("effects use a compressed upbeat Web Audio mix", async () => {
  const audio = await readFile(new URL("../public/audio.js", import.meta.url), "utf8");
  assert.match(audio, /createDynamicsCompressor\(\)/);
  assert.match(audio, /createDelay\(0\.25\)/);
  assert.match(audio, /delay\.delayTime\.value = 0\.065/);
  assert.match(audio, /feedback\.gain\.value = 0\.02/);
  assert.match(audio, /wet\.gain\.value = 0\.018/);
  assert.match(audio, /resonantMallet\(frequency/);
  assert.match(audio, /softArpeggio\(frequencies/);
  assert.doesNotMatch(audio, /oscillator\.type = "triangle"/);
  assert.doesNotMatch(audio, /warmPad/);
  assert.match(audio, /effectsGain\.connect\(compressor\)\.connect\(this\.context\.destination\)/);
  assert.match(audio, /effectsGain\.gain\.value = 0\.86/);
  assert.match(audio, /this\.musicTrack\.volume = Math\.max\(0, Math\.min\(1, nextVolume\)\)/);
  assert.match(audio, /select\(\)[\s\S]*resonantMallet\(261\.63/);
  assert.doesNotMatch(audio, /noiseBurst|createBufferSource/);
  assert.doesNotMatch(audio, /oscillator\.type = "square"/);
  assert.doesNotMatch(audio, /endFrequency/);
  assert.match(audio, /correct\(\)[\s\S]*resonantMallet\(220[\s\S]*softArpeggio\(\[440, 554\.37, 659\.25, 880\]/);
  assert.match(audio, /incorrect\(\)[\s\S]*resonantMallet\(220[\s\S]*resonantMallet\(277\.18/);
  assert.match(audio, /transition\(\)[\s\S]*softArpeggio\(\[261\.63, 392, 523\.25, 659\.25\]/);
  assert.match(audio, /finalQuestion\(\)[\s\S]*softArpeggio\(\[146\.83, 220, 293\.66, 440\]/);
});

test("the public home does not expose the temporary sound-check QA panel", async () => {
  const [client, page, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /sound-check|SOUND CHECK|AUDIO PREVIEW/);
  assert.doesNotMatch(client, /soundCheck|soundPreviews|data-sound-preview/);
  assert.doesNotMatch(styles, /sound-check/);
});

test("countdown ticks only during level transitions and resolves when each question starts", async () => {
  const [client, audio] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/audio.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /chillAudio\.tick\(tick\)/);
  assert.match(client, /room\?\.phase==="transition"&&seconds<=3[\s\S]*chillAudio\.tick\(seconds\)/);
  assert.match(client, /state\.phase === "question" && previousPhase !== "question"\) chillAudio\.start\(\)/);
  assert.doesNotMatch(client, /onclick=\(\)=>\{chillAudio\.start\(\);socket\.emit\("game:start"/);
  assert.match(audio, /frequency = step === 3 \? 220 : step === 2 \? 246\.94 : 293\.66/);
  assert.match(audio, /duration = step === 3 \? 0\.18 : step === 2 \? 0\.21 : 0\.25/);
  assert.doesNotMatch(audio, /previewCountdown/);
  assert.match(audio, /start\(offset = 0\)[\s\S]*resonantMallet\(196, 0\.48[\s\S]*softArpeggio\(\[261\.63, 392, 523\.25\], 0\.085, 0\.58, 0\.046, 6500, offset\)/);
});

test("valid create-room and lobby-start actions have distinct confirmation cues", async () => {
  const [client, audio, server, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/audio.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /if \(!nameInput\.value\.trim\(\)\) return showError\([\s\S]*?showError\(""\);[\s\S]*?chillAudio\.createRoom\(\);/);
  assert.match(client, /onclick=\(\)=>\{chillAudio\.lobbyStart\(\);socket\.emit\("game:start"/);
  assert.match(audio, /createRoom\(\)[\s\S]*resonantMallet\(293\.66[\s\S]*resonantMallet\(440/);
  assert.match(audio, /lobbyStart\(\)[\s\S]*resonantMallet\(220[\s\S]*resonantMallet\(329\.63/);
  assert.match(audio, /start\(offset = 0\)[\s\S]*softArpeggio/);
  assert.match(client, /const SOCKET_CONNECT_TIMEOUT_MS = 20000/);
  assert.match(client, /const SOCKET_ACK_TIMEOUT_MS = 10000/);
  assert.match(client, /transports: \["websocket", "polling"\]/);
  assert.match(client, /tryAllTransports: true/);
  assert.match(client, /function waitForSocketConnection\([\s\S]*socket\.once\("connect",onConnect\)/);
  assert.doesNotMatch(client, /socket\.once\("connect_error"/);
  assert.match(client, /socket\.timeout\(ackTimeoutMs\)\.emit\(event,payload/);
  assert.match(audio, /this\.musicTrack\.preload = "metadata"/);
  assert.match(client, /setRoomActionBusy\(createButton,createLabel,true,[\s\S]*CREATING/);
  assert.match(client, /Connection interrupted\. Try again\./);
  assert.match(client, /setRoomActionBusy\(joinButton,joinButton,true,[\s\S]*JOINING/);
  assert.match(styles, /\.entry-card button\[aria-busy="true"\]/);
  assert.match(server, /function attachedSocketPlayer\(socket\)/);
  assert.match(server, /if \(attached\) \{[\s\S]*code: attached\.room\.code[\s\S]*emitRoom\(attached\.room\)/);
});

test("an invitation link becomes a dedicated join screen", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /if\(linkedCode\) configureInviteJoin\(linkedCode, inviteParams\.get\("host"\)\);/);
  assert.match(client, /You're joining \$\{host\}'s room\./);
  assert.match(client, /JOIN THIS ROOM/);
  assert.match(client, /BACK TO HOME/);
  assert.match(client, /url\.searchParams\.set\("host",host\)/);
  assert.match(styles, /\.invite-join-context/);
});

test("leaving requires confirmation and awards the match to the last remaining player", async () => {
  const [client, page, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Do you wish to quit this game\?/);
  assert.match(page, /id="leave-confirm"/);
  assert.match(client, /function requestLeave\(\)/);
  assert.match(client, /leaveDialog\.showModal\(\)/);
  assert.match(client, /If only one player remains, they will win the game\./);
  assert.match(server, /function finishIfLastPlayer\(room\)/);
  assert.match(server, /shouldFinishAfterLeave\(room\.phase, room\.players\.size\)/);
  assert.match(server, /room\.phase = "finished"/);
  assert.match(server, /wins as the last player remaining/);
  assert.match(server, /typeof payloadOrReply === "function"[\s\S]*typeof maybeReply === "function"/);
  assert.match(server, /server\.listen\(PORT, "0\.0\.0\.0"/);
});

test("only an active match with one remaining player ends after an explicit leave", () => {
  assert.equal(shouldFinishAfterLeave("question", 1), true);
  assert.equal(shouldFinishAfterLeave("reveal", 1), true);
  assert.equal(shouldFinishAfterLeave("transition", 1), true);
  assert.equal(shouldFinishAfterLeave("loading", 1), true);
  assert.equal(shouldFinishAfterLeave("lobby", 1), false);
  assert.equal(shouldFinishAfterLeave("finished", 1), false);
  assert.equal(shouldFinishAfterLeave("question", 2), false);
  assert.equal(shouldFinishAfterLeave("question", 0), false);
});

test("horizontal standings rank players while preserving the pre-question score snapshot", () => {
  const players = new Map([
    ["a", { id: "a", name: "Alex", score: 2200, connected: true }],
    ["b", { id: "b", name: "Blair", score: 3100, connected: true }],
    ["c", { id: "c", name: "Casey", score: 900, connected: false }],
  ]);
  const snapshot = new Map([["a", 1200], ["b", 1100], ["c", 900]]);
  assert.deepEqual(
    rankPlayers(players, snapshot).map(({ id, score, rank }) => ({ id, score, rank })),
    [
      { id: "a", score: 1200, rank: 1 },
      { id: "b", score: 1100, rank: 2 },
      { id: "c", score: 900, rank: 3 },
    ],
  );
  assert.equal(rankPlayers(players)[0].id, "b");
});

test("the transition names the final question explicitly", async () => {
  const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(client, /tr\("Final question","Pregunta final"\)/);
  assert.match(client, /One specialist hard question — make it count!/);
});

test("trivia API sessions are owned by the server, never by a browser", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /TRIVIA_SESSION_KEY|triviaSessionId/);
  assert.match(server, /let activeTriviaSessionId = null/);
  assert.match(server, /sessionId: activeTriviaSessionId/);
});

test("answer selection updates only the option instead of rerendering the question", async () => {
  const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(client, /function lockAnswerSelection\(selectedButton\)/);
  assert.match(client, /lockAnswerSelection\(btn\)/);
  assert.match(client, /q\.id!==lastAnimatedQuestionId/);
  assert.match(client, /const sameLiveQuestion = previousPhase === "question" && state\.phase === "question"/);
  assert.match(client, /if \(sameLiveQuestion\) return syncLiveQuestionState\(\);/);
  assert.match(client, /function syncLiveQuestionState\(\)[\s\S]*currentScoreboard\.replaceWith\(nextScoreboard\.content\.firstElementChild\)/);
  assert.doesNotMatch(client, /socket\.emit\("answer:submit",\{optionIndex:selected\}\);render\(\)/);
});

test("question timer keeps its server-derived progress across room state updates", async () => {
  const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(client, /const initialProgress=reveal\?0:timerProgressPercent\(deadline,q\.durationMs\)/);
  assert.match(client, /style="width:\$\{initialProgress\}%"/);
  assert.match(client, /Math\.max\(0,Math\.min\(100,remaining\/duration\*100\)\)/);
  assert.match(client, /updateTimerBar\(\);\s*timer=setInterval\(updateTimerBar,100\)/);
  assert.doesNotMatch(client, /style="width:\$\{reveal\?0:100\}%"/);
});

test("the reveal moves earned points into standings and removes duplicate result UI", async () => {
  const [client, styles, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);
  assert.match(client, /horizontalScoreboard\(room\.scoreboard \?\? \[\], room\.selfId, animateScoreGain\?earnedPoints:0\)/);
  assert.match(client, /const showGain=isSelf&&pointsEarned>0/);
  assert.match(client, /class="score-gain" role="status" aria-live="polite"/);
  assert.match(client, /class="live-total"/);
  assert.doesNotMatch(client, /function resultCard\(/);
  assert.doesNotMatch(client, /miniBoard\(room\.reveal\.leaderboard\)/);
  assert.match(styles, /@keyframes score-gain-across/);
  assert.match(styles, /@keyframes score-total-pop/);
  assert.match(styles, /prefers-reduced-motion:reduce[^}]*\.score-gain/s);
});

test("separate product homes lock Standard or bilingual Football Night by hostname", async () => {
  const [client, page, styles, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /data-mode="standard"/);
  assert.doesNotMatch(page, /data-mode="football"/);
  assert.doesNotMatch(page, /class="mode-options"/);
  assert.match(page, /id="product-language-picker"/);
  assert.doesNotMatch(page, /id="product-language-picker"[^>]*hidden/);
  assert.match(page, /document\.body\.dataset\.gameMode = "football"/);
  assert.match(page, /data-language="en"/);
  assert.match(page, /data-language="es"/);
  assert.match(client, /const PRODUCT_MODE = location\.hostname\.toLowerCase\(\)\.startsWith\("football\."\)/);
  assert.match(client, /languagePicker\.remove\(\)/);
  assert.match(client, /new URL\("\/football", location\.origin\)/);
  assert.match(client, /function applyHomeLanguage\(\)/);
  assert.match(client, /Sabé de fútbol\./);
  assert.match(client, /Ingresá tu nombre y el código de sala\./);
  assert.match(client, /function roomInviteUrl\(roomState\)/);
  assert.match(client, /gameMode: homeMode/);
  assert.match(server, /loadFootballQuestions\(\{ language: room\.language/);
  assert.match(server, /gameMode: cleanMode, language: cleanLanguage/);
  assert.match(server, /fileURLToPath\(new URL\("\.\/public\/index\.html", import\.meta\.url\)\)/);
  assert.match(styles, /body\[data-game-mode="football"\]/);
  assert.match(styles, /\.football-stadium/);
  assert.match(styles, /\.home-language-bar/);
  assert.match(client, /const FOOTBALL_LANGUAGE_KEY = "quiz-and-chill-football-language"/);
  assert.match(client, /savedFootballLanguage !== "en" \? "es" : "en"/);
  assert.match(client, /localStorage\.setItem\(FOOTBALL_LANGUAGE_KEY, homeLanguage\)/);
  assert.match(page, /data-language="es" class="selected" aria-pressed="true"/);
  assert.match(styles, /body\[data-game-mode="football"\] \.live-score\.is-you/);
});

test("music defaults to enabled at fifty percent while preserving saved preferences", async () => {
  const [client, audio, html] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/audio.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(audio, /storedMusicVolume === null/);
  assert.match(audio, /: 0\.5;/);
  assert.match(audio, /const MUSIC_BASE_GAIN = 0\.18/);
  assert.match(audio, /this\.musicMuted = localStorage\.getItem\(MUSIC_MUTED_KEY\) === "true"/);
  assert.match(client, /chillAudio\.unlock\(\);/);
  assert.match(client, /addEventListener\("pointerdown", unlockAudio/);
  assert.match(client, /addEventListener\("keydown", unlockAudio/);
  assert.match(html, /id="music-volume"[^>]*value="50"/);
});

test("the category picker has ten cards in a five-column desktop grid", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.category-grid\{display:grid;grid-template-columns:repeat\(5,/);
  assert.match(styles, /\.art-food-and-drink::before/);
});

test("question reveals keep standings and answer markers without lower duplicate panels", async () => {
  const [client, styles, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /miniBoard\(room\.reveal\.leaderboard\)/);
  assert.doesNotMatch(client, /Standings after this question/);
  assert.doesNotMatch(client, /function resultCard\(/);
  assert.match(client, /showGain\?`<span class="score-gain"/);
  assert.doesNotMatch(client, /question-wrap \$\{reveal\?"is-reveal"/);
  assert.doesNotMatch(styles, /\.question-wrap\.is-reveal/);
  assert.match(styles, /\.question-wrap\{min-height:calc\(100dvh - 72px\)\}/);
  assert.match(client, /reveal\?`\$\{tr\("NEXT","SIGUIENTE"\)\} <strong id="phase-countdown"/);
  assert.match(styles, /\.question-meta span:last-child\{white-space:nowrap\}/);
  assert.match(styles, /body:has\(#room-pill:not\(\.hidden\)\) \.creator-credit\{display:none\}/);
  assert.match(server, /answerMarkers: revealAnswerMarkers\(room\)/);
  assert.match(client, /function answerMarkers\(optionIndex\)/);
  assert.match(client, /marker\.selectedIndex===optionIndex/);
  assert.match(styles, /\.answer-marker\{/);
});

