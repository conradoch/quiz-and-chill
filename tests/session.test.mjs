import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resetPlayersForReplay } from "../game/session.js";

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
  const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(client, /id="go-home"[^>]*>BACK TO HOME</);
  assert.match(client, /localStorage\.removeItem\(SESSION_KEY\)/);
  assert.match(client, /location\.replace\(location\.pathname\)/);
});
