import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { gameConfig, questions } from "./game/questions.js";
import { answerResult, publicQuestion, scoreAnswer } from "./game/engine.js";
import { CATEGORY_OPTIONS, loadQuestions } from "./game/question-provider.js";
import { resetPlayersForReplay } from "./game/session.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.static("public", {
  cacheControl: false,
  setHeaders(res, filePath) {
    if (/\.(?:html|js|css)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
    }
  },
}));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("*splat", (_req, res) => res.sendFile(new URL("./public/index.html", import.meta.url).pathname));

function code() {
  let id;
  do id = crypto.randomBytes(3).toString("hex").toUpperCase(); while (rooms.has(id));
  return id;
}
function roomView(room, viewerId) {
  const answer = room.answers?.get(viewerId);
  return {
    code: room.code, phase: room.phase, hostId: room.hostId, selfId: viewerId,
    canManageRoom: viewerId === room.hostId,
    players: [...room.players.values()].map(({ id, name, score, answered, connected }) => ({ id, name, score, answered, connected })),
    notices: room.notices.slice(-6),
    question: room.phase === "question" || room.phase === "reveal" ? publicQuestion(room.questionIndex, room.questions) : null,
    nextLevel: room.phase === "transition" ? publicQuestion(room.questionIndex, room.questions) : null,
    questionSource: room.questionSource,
    category: CATEGORY_OPTIONS.find(option => option.key === room.categoryKey) ?? CATEGORY_OPTIONS[0],
    categoryOptions: room.phase === "lobby" ? CATEGORY_OPTIONS.map(({ key, label }) => ({ key, label })) : null,
    reveal: room.phase === "reveal" ? {
      ...answerResult(
        room.questionIndex,
        answer ? answer.selectedIndex : null,
        answer ? answer.pointsEarned : 0,
        room.questions,
      ),
      leaderboard: leaderboard(room),
    } : null,
    leaderboard: room.phase === "finished" ? leaderboard(room) : null,
  };
}
function leaderboard(room) {
  return [...room.players.values()].sort((a, b) => b.score - a.score).map(({ id, name, score }, i) => ({ id, name, score, rank: i + 1 }));
}
function emitRoom(room) {
  for (const player of room.players.values()) {
    if (player.connected && player.socketId) {
      io.sockets.sockets.get(player.socketId)?.emit("room:state", roomView(room, player.id));
    }
  }
}
function addNotice(room, text, type = "info") {
  room.notices.push({ id: crypto.randomUUID(), text, type, at: Date.now() });
  if (room.notices.length > 20) room.notices.shift();
}
function attachPlayer(socket, room, player) {
  clearTimeout(room.emptyTimer);
  clearTimeout(player.hostTransferTimer);
  player.socketId = socket.id;
  player.connected = true;
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  socket.join(room.code);
}
function clearTimers(room) { clearTimeout(room.questionTimer); clearTimeout(room.revealTimer); clearTimeout(room.transitionTimer); }
function beginQuestion(room) {
  clearTimers(room);
  if (room.questionIndex >= room.questions.length) {
    room.phase = "finished"; emitRoom(room); return;
  }
  if ([3, 6, 9].includes(room.questionIndex) && !room.transitionsShown.has(room.questionIndex)) {
    room.transitionsShown.add(room.questionIndex);
    room.phase = "transition";
    emitRoom(room);
    room.transitionTimer = setTimeout(() => beginQuestion(room), gameConfig.transitionTimeMs);
    return;
  }
  room.phase = "question";
  room.questionStartedAt = Date.now();
  room.answers = new Map();
  for (const player of room.players.values()) {
    player.answered = false;
  }
  emitRoom(room);
  room.questionTimer = setTimeout(() => reveal(room), gameConfig.questionTimeMs);
}
function reveal(room) {
  if (room.phase !== "question") return;
  room.phase = "reveal"; emitRoom(room);
  room.revealTimer = setTimeout(() => { room.questionIndex += 1; beginQuestion(room); }, gameConfig.revealTimeMs);
}

io.on("connection", socket => {
  socket.on("room:create", ({ name, playerId: requestedId }, reply) => {
    const roomCode = code();
    const playerId = cleanPlayerId(requestedId);
    const player = { id: playerId, socketId: socket.id, connected: true, name: cleanName(name), score: 0, answered: false };
    const room = { code: roomCode, hostId: playerId, phase: "lobby", players: new Map([[playerId, player]]), questionIndex: 0, transitionsShown: new Set(), questions, questionSource: "local", categoryKey: "all", notices: [] };
    rooms.set(roomCode, room); attachPlayer(socket, room, player);
    reply?.({ ok: true, code: roomCode, playerId }); emitRoom(room);
  });
  socket.on("room:join", ({ code: rawCode, name, playerId: requestedId }, reply) => {
    const room = rooms.get(String(rawCode || "").toUpperCase());
    if (!room || room.phase !== "lobby") return reply?.({ ok: false, error: "Room not found or game already started." });
    const playerId = cleanPlayerId(requestedId);
    if (room.players.has(playerId)) return reply?.({ ok: false, error: "This player session is already in the room." });
    const player = { id: playerId, socketId: socket.id, connected: true, name: cleanName(name), score: 0, answered: false };
    room.players.set(playerId, player); attachPlayer(socket, room, player);
    addNotice(room, `${player.name} joined the room`, "join");
    reply?.({ ok: true, code: room.code, playerId }); emitRoom(room);
  });
  socket.on("room:resume", ({ code: rawCode, playerId }, reply) => {
    const room = rooms.get(String(rawCode || "").toUpperCase());
    const player = room?.players.get(String(playerId || ""));
    if (!room || !player) return reply?.({ ok: false, error: "That room or player session is no longer available." });
    const wasDisconnected = !player.connected;
    attachPlayer(socket, room, player);
    if (wasDisconnected) addNotice(room, `${player.name} reconnected`, "return");
    reply?.({ ok: true, code: room.code, playerId: player.id }); emitRoom(room);
  });
  socket.on("game:start", async () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== "lobby") return;
    room.phase = "loading"; emitRoom(room);
    const loaded = await loadQuestions({ category: room.categoryKey });
    if (!rooms.has(room.code) || !room.players.size) return;
    room.questions = loaded.questions;
    room.questionSource = loaded.source;
    room.questionIndex = 0; room.transitionsShown.clear(); beginQuestion(room);
  });
  socket.on("category:set", ({ category }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== "lobby") return;
    if (!CATEGORY_OPTIONS.some(option => option.key === category)) return;
    room.categoryKey = category;
    emitRoom(room);
  });
  socket.on("answer:submit", ({ optionIndex }) => {
    const room = rooms.get(socket.data.roomCode); const player = room?.players.get(socket.data.playerId);
    if (!room || !player || room.phase !== "question" || player.answered) return;
    const selectedIndex = Number(optionIndex);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= room.questions[room.questionIndex].options.length) return;
    player.answered = true;
    const elapsed = Math.max(0, Date.now() - room.questionStartedAt);
    const pointsEarned = scoreAnswer(room.questionIndex, selectedIndex, elapsed, room.questions);
    room.answers.set(player.id, { selectedIndex, pointsEarned });
    player.score += pointsEarned;
    emitRoom(room);
    if ([...room.players.values()].filter(p => p.connected).every(p => p.answered)) setTimeout(() => reveal(room), 500);
  });
  socket.on("game:restart", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== "finished") return;
    clearTimers(room);
    room.phase = "lobby";
    room.questionIndex = 0;
    room.answers = new Map();
    room.transitionsShown.clear();
    room.questionSource = "local";
    resetPlayersForReplay(room.players);
    addNotice(room, "The room is ready for another game", "restart");
    emitRoom(room);
  });
  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const player = room.players.get(socket.data.playerId);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    addNotice(room, `${player.name} disconnected`, "leave");
    if (room.hostId === player.id) {
      player.hostTransferTimer = setTimeout(() => {
        if (player.connected || !rooms.has(room.code)) return;
        const nextHost = [...room.players.values()].find(candidate => candidate.connected);
        if (nextHost) {
          room.hostId = nextHost.id;
          addNotice(room, `${nextHost.name} is now the host`, "host");
          emitRoom(room);
        }
      }, 15000);
    }
    if (![...room.players.values()].some(candidate => candidate.connected)) {
      room.emptyTimer = setTimeout(() => {
        if ([...room.players.values()].some(candidate => candidate.connected)) return;
        clearTimers(room);
        rooms.delete(room.code);
      }, 300000);
    }
    emitRoom(room);
  });
});
function cleanName(name) { return String(name || "Player").trim().slice(0, 24) || "Player"; }
function cleanPlayerId(value) {
  const candidate = String(value || "");
  return /^[a-zA-Z0-9-]{8,64}$/.test(candidate) ? candidate : crypto.randomUUID();
}
server.listen(PORT, () => console.log(`Quiz & Chill ready at http://localhost:${PORT}`));
