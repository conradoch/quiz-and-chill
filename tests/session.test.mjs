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

test("finished screen offers a clean return to the home page", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);

  assert.match(client, /id="go-home"[^>]*>BACK TO HOME</);
  assert.match(client, /localStorage\.removeItem\(SESSION_KEY\)/);
  assert.match(client, /socket\.emit\("room:leave", navigate\)/);
  assert.match(client, /new URL\("\/", location\.origin\)\.href/);
  assert.match(client, /brandLink\.onclick/);
  assert.match(server, /socket\.on\("room:leave"/);
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
  assert.match(client, /One last challenge — make it count!/);
});
