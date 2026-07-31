import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resetPlayersForReplay, shouldFinishAfterLeave } from "../game/session.js";

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
