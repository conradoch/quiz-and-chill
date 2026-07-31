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

  assert.match(client, /id="go-home"[^>]*>BACK TO HOME</);
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
  assert.match(audio, /roundedNote\(frequency/);
  assert.match(audio, /effectsGain\.connect\(compressor\)\.connect\(this\.context\.destination\)/);
  assert.match(audio, /select\(\)[\s\S]*523\.25[\s\S]*987\.77/);
  assert.match(audio, /correct\(\)[\s\S]*523\.25[\s\S]*1046\.5/);
  assert.match(audio, /incorrect\(\)[\s\S]*392[\s\S]*293\.66/);
  assert.match(audio, /transition\(\)[\s\S]*261\.63[\s\S]*659\.25/);
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
  assert.match(client, /isFinal\?"Final question":"Get ready for the next level"/);
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
  assert.doesNotMatch(client, /socket\.emit\("answer:submit",\{optionIndex:selected\}\);render\(\)/);
});

test("the reveal uses an accessible compact result strip and animated score pill", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /role="status" aria-live="polite"/);
  assert.match(client, /hit\?"Correct":"Incorrect"/);
  assert.match(client, /Correct answer:/);
  assert.doesNotMatch(client, /Your pick/);
  assert.match(client, /points-pill/);
  assert.match(client, /points-flight/);
  assert.match(styles, /@keyframes points-to-score/);
  assert.match(styles, /prefers-reduced-motion:reduce[^}]*\.points-flight/s);
});

test("music defaults to enabled at fifty percent while preserving saved preferences", async () => {
  const [client, audio, html] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/audio.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(audio, /storedMusicVolume === null/);
  assert.match(audio, /: 0\.5;/);
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

test("question reveals keep standings unchanged and use a compact result strip", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /miniBoard\(room\.reveal\.leaderboard\)/);
  assert.doesNotMatch(client, /Standings after this question/);
  assert.match(client, /Correct answer:/);
  assert.doesNotMatch(client, /Your pick/);
  assert.match(styles, /\.result-card\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/);
});
