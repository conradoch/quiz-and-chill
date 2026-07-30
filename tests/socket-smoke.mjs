import assert from "node:assert/strict";
import { io } from "socket.io-client";

const URL = "http://localhost:3000";
const host = io(URL, { reconnection: false });
const guest = io(URL, { reconnection: false });

const once = (socket, event, predicate = () => true, timeoutMs = 3000) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.off(event, handler);
    reject(new Error(`Timed out waiting for ${event}`));
  }, timeoutMs);
  const handler = value => {
    if (!predicate(value)) return;
    clearTimeout(timeout);
    socket.off(event, handler);
    resolve(value);
  };
  socket.on(event, handler);
});

const ack = (socket, event, payload) => new Promise(resolve => socket.emit(event, payload, resolve));

await Promise.all([once(host, "connect"), once(guest, "connect")]);

const hostStatePromise = once(host, "room:state", state => state.phase === "lobby");
const created = await ack(host, "room:create", { name: "Host", playerId: "host-session-123" });
assert.equal(created.ok, true);
const hostState = await hostStatePromise;
assert.equal(hostState.selfId, "host-session-123");
assert.equal(hostState.hostId, "host-session-123");

const joinedNoticePromise = once(host, "room:state", state => state.notices.some(notice => notice.text === "Guest joined the room"));
const joined = await ack(guest, "room:join", { code: created.code, name: "Guest", playerId: "guest-session-123" });
assert.equal(joined.ok, true);
const joinedState = await joinedNoticePromise;
assert.equal(joinedState.players.length, 2);

const disconnectedPromise = once(host, "room:state", state => state.notices.some(notice => notice.text === "Guest disconnected"));
guest.close();
const disconnectedState = await disconnectedPromise;
assert.equal(disconnectedState.players.find(player => player.id === "guest-session-123").connected, false);

const returningGuest = io(URL, { reconnection: false });
await once(returningGuest, "connect");
const resumedStatePromise = once(returningGuest, "room:state", state => state.selfId === "guest-session-123");
const reconnectedNoticePromise = once(host, "room:state", state => state.notices.some(notice => notice.text === "Guest reconnected"));
const resumed = await ack(returningGuest, "room:resume", { code: created.code, playerId: "guest-session-123" });
assert.equal(resumed.ok, true);
const [resumedState, reconnectedState] = await Promise.all([resumedStatePromise, reconnectedNoticePromise]);
assert.equal(resumedState.players.find(player => player.id === "guest-session-123").connected, true);
assert.equal(reconnectedState.players.length, 2);

host.close();
returningGuest.close();
console.log("Socket smoke test passed: create, join, disconnect, and resume preserve identity.");
