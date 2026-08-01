import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { gameConfig, questions } from "./game/questions.js";
import { answerResult, publicQuestion, scoreAnswer } from "./game/engine.js";
import { CATEGORY_OPTIONS, loadQuestions, RecentQuestionHistory, recentQuestionHistory } from "./game/question-provider.js";
import { loadFootballQuestions } from "./game/football-questions.js";
import { rankPlayers, resetPlayersForReplay, shouldFinishAfterLeave } from "./game/session.js";

try { process.loadEnvFile?.(".env"); } catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
let activeTriviaSessionId = null;
const PORT = Number(process.env.PORT) || 3000;
const indexPath = fileURLToPath(new URL("./public/index.html", import.meta.url));

app.use(express.static("public", {
  cacheControl: false,
  setHeaders(res, filePath) {
    if (/\.(?:html|js|css)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
    }
  },
}));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("*splat", (_req, res) => res.sendFile(indexPath));

function code() {
  let id;
  do id = crypto.randomBytes(3).toString("hex").toUpperCase(); while (rooms.has(id));
  return id;
}
function roomView(room, viewerId) {
  const answer = room.answers?.get(viewerId);
  return {
    code: room.code, phase: room.phase, hostId: room.hostId, selfId: viewerId,
    phaseEndsAt: room.phaseEndsAt ?? null,
    canManageRoom: viewerId === room.hostId,
    players: [...room.players.values()].map(({ id, name, score, answered, connected }) => ({ id, name, score, answered, connected })),
    notices: room.notices.slice(-6),
    question: room.phase === "question" || room.phase === "reveal" ? publicQuestion(room.questionIndex, room.questions, room.language) : null,
    nextLevel: room.phase === "transition" ? publicQuestion(room.questionIndex, room.questions, room.language) : null,
    questionSource: room.questionSource,
    questionLoadError: room.questionLoadError ?? null,
    gameMode: room.gameMode,
    language: room.language,
    modeLabel: room.gameMode === "football" ? "Football Night" : "Standard",
    category: room.gameMode === "football"
      ? { key: "football", label: room.language === "es" ? "Fútbol" : "Football" }
      : CATEGORY_OPTIONS.find(option => option.key === room.categoryKey) ?? CATEGORY_OPTIONS[0],
    categoryOptions: room.phase === "lobby" && room.gameMode === "standard"
      ? CATEGORY_OPTIONS.map(({ key, label }) => ({ key, label }))
      : null,
    scoreboard: ["question", "reveal"].includes(room.phase)
      ? rankPlayers(room.players, room.phase === "question" ? room.scoreboardSnapshot : null)
      : null,
    reveal: room.phase === "reveal" ? {
      ...answerResult(
        room.questionIndex,
        answer ? answer.selectedIndex : null,
        answer ? answer.pointsEarned : 0,
        room.questions,
      ),
      answerMarkers: revealAnswerMarkers(room),
      leaderboard: leaderboard(room),
    } : null,
    leaderboard: room.phase === "finished" ? leaderboard(room) : null,
  };
}
function revealAnswerMarkers(room) {
  return [...room.answers.entries()].flatMap(([playerId, answer]) => {
    const player = room.players.get(playerId);
    if (!player || !Number.isInteger(answer?.selectedIndex)) return [];
    return [{ playerId, name: player.name, initial: player.name.trim().charAt(0).toUpperCase() || "?", selectedIndex: answer.selectedIndex }];
  });
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
function roomText(room, key, name = "") {
  const copy = {
    en: {
      lastWinner: `${name} wins as the last player remaining`, joined: `${name} joined the room`,
      reconnected: `${name} reconnected`, replay: "The room is ready for another game",
      host: `${name} is now the host`, left: `${name} left the room`, disconnected: `${name} disconnected`,
    },
    es: {
      lastWinner: `${name} gana por ser el último jugador en pie`, joined: `${name} se unió a la sala`,
      reconnected: `${name} volvió a conectarse`, replay: "La sala está lista para otra partida",
      host: `${name} ahora es el anfitrión`, left: `${name} abandonó la sala`, disconnected: `${name} se desconectó`,
    },
  };
  return copy[room.language === "es" ? "es" : "en"][key];
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
function finishIfLastPlayer(room) {
  if (!shouldFinishAfterLeave(room.phase, room.players.size)) return false;
  clearTimers(room);
  room.phase = "finished";
  room.answers = new Map();
  const winner = room.players.values().next().value;
  addNotice(room, roomText(room, "lastWinner", winner.name), "winner");
  return true;
}
function beginQuestion(room) {
  clearTimers(room);
  if (room.questionIndex >= room.questions.length) {
    room.phase = "finished"; emitRoom(room); return;
  }
  if ([3, 6, 9].includes(room.questionIndex) && !room.transitionsShown.has(room.questionIndex)) {
    room.transitionsShown.add(room.questionIndex);
    room.phase = "transition";
    const transitionDuration = room.questionIndex === 9 ? gameConfig.finalTransitionTimeMs : gameConfig.transitionTimeMs;
    room.phaseEndsAt = Date.now() + transitionDuration;
    emitRoom(room);
    room.transitionTimer = setTimeout(() => beginQuestion(room), transitionDuration);
    return;
  }
  room.phase = "question";
  room.questionStartedAt = Date.now();
  room.phaseEndsAt = room.questionStartedAt + gameConfig.questionTimeMs;
  room.answers = new Map();
  room.scoreboardSnapshot = new Map([...room.players.values()].map(player => [player.id, player.score]));
  for (const player of room.players.values()) {
    player.answered = false;
  }
  emitRoom(room);
  room.questionTimer = setTimeout(() => reveal(room), gameConfig.questionTimeMs);
}
function reveal(room) {
  if (room.phase !== "question") return;
  room.phase = "reveal";
  room.phaseEndsAt = Date.now() + gameConfig.revealTimeMs;
  emitRoom(room);
  room.revealTimer = setTimeout(() => { room.questionIndex += 1; beginQuestion(room); }, gameConfig.revealTimeMs);
}

function attachedSocketPlayer(socket) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.data.playerId);
  return player?.socketId === socket.id ? { room, player } : null;
}

io.on("connection", socket => {
  socket.on("room:create", ({ name, playerId: requestedId, gameMode, language }, reply) => {
    // A slow connection or a repeated tap can deliver the same intent more
    // than once. Reuse the room already attached to this socket instead of
    // leaking an orphan room or racing two acknowledgements.
    const attached = attachedSocketPlayer(socket);
    if (attached) {
      reply?.({ ok: true, code: attached.room.code, playerId: attached.player.id });
      emitRoom(attached.room);
      return;
    }
    const roomCode = code();
    const playerId = cleanPlayerId(requestedId);
    const player = { id: playerId, socketId: socket.id, connected: true, name: cleanName(name), score: 0, answered: false };
    const cleanMode = gameMode === "football" ? "football" : "standard";
    const cleanLanguage = cleanMode === "football" && language === "es" ? "es" : "en";
    const room = { code: roomCode, hostId: playerId, phase: "lobby", players: new Map([[playerId, player]]), questionIndex: 0, transitionsShown: new Set(), questions, questionSource: null, questionLoadError: null, categoryKey: "all", gameMode: cleanMode, language: cleanLanguage, notices: [] };
    rooms.set(roomCode, room); attachPlayer(socket, room, player);
    reply?.({ ok: true, code: roomCode, playerId }); emitRoom(room);
  });
  socket.on("room:join", ({ code: rawCode, name, playerId: requestedId }, reply) => {
    const room = rooms.get(String(rawCode || "").toUpperCase());
    if (!room || room.phase !== "lobby") return reply?.({ ok: false, error: "Room not found or game already started." });
    const playerId = cleanPlayerId(requestedId);
    const attached = attachedSocketPlayer(socket);
    if (attached?.room === room && attached.player.id === playerId) {
      reply?.({ ok: true, code: room.code, playerId });
      emitRoom(room);
      return;
    }
    if (attached) return reply?.({ ok: false, error: "This connection is already in a room." });
    if (room.players.has(playerId)) return reply?.({ ok: false, error: "This player session is already in the room." });
    const player = { id: playerId, socketId: socket.id, connected: true, name: cleanName(name), score: 0, answered: false };
    room.players.set(playerId, player); attachPlayer(socket, room, player);
    addNotice(room, roomText(room, "joined", player.name), "join");
    reply?.({ ok: true, code: room.code, playerId }); emitRoom(room);
  });
  socket.on("room:resume", ({ code: rawCode, playerId }, reply) => {
    const room = rooms.get(String(rawCode || "").toUpperCase());
    const player = room?.players.get(String(playerId || ""));
    if (!room || !player) return reply?.({ ok: false, error: "That room or player session is no longer available." });
    const wasDisconnected = !player.connected;
    attachPlayer(socket, room, player);
    if (wasDisconnected) addNotice(room, roomText(room, "reconnected", player.name), "return");
    reply?.({ ok: true, code: room.code, playerId: player.id }); emitRoom(room);
  });
  socket.on("game:start", async ({ recentQuestions } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== "lobby") return;
    room.phase = "loading";
    room.questionLoadError = null;
    emitRoom(room);
    const browserHistory = new RecentQuestionHistory(300);
    browserHistory.remember(cleanRecentQuestions(recentQuestions));
    const combinedHistory = {
      has: item => recentQuestionHistory.has(item) || browserHistory.has(item),
      hasId: id => recentQuestionHistory.hasId(id) || browserHistory.hasId(id),
      remember: items => recentQuestionHistory.remember(items),
    };
    const loaded = room.gameMode === "football"
      ? loadFootballQuestions({ language: room.language, history: combinedHistory })
      : await loadQuestions({
        category: room.categoryKey,
        history: combinedHistory,
        apiKey: process.env.TRIVIA_API_KEY ?? "",
        sessionId: activeTriviaSessionId,
        allowLocalFallback: false,
      });
    if (!rooms.has(room.code) || !room.players.size) return;
    if (loaded.source === "unavailable" || loaded.questions.length < 10) {
      room.phase = "lobby";
      room.questionSource = "unavailable";
      room.questionLoadError = room.language === "es"
        ? "El servicio de preguntas no está disponible temporalmente. Inténtalo de nuevo."
        : "Question service temporarily unavailable. Please try again.";
      emitRoom(room);
      return;
    }
    room.questions = loaded.questions;
    room.questionSource = loaded.source;
    room.questionLoadError = null;
    if (room.gameMode === "standard") activeTriviaSessionId = loaded.sessionId ?? activeTriviaSessionId;
    room.questionIndex = 0; room.transitionsShown.clear(); beginQuestion(room);
  });
  socket.on("category:set", ({ category }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.gameMode !== "standard" || room.hostId !== socket.data.playerId || room.phase !== "lobby") return;
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
    room.questionSource = null;
    room.questionLoadError = null;
    resetPlayersForReplay(room.players);
    addNotice(room, roomText(room, "replay"), "restart");
    emitRoom(room);
  });
  socket.on("room:leave", reply => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.data.playerId);
    if (!room || !player) {
      reply?.({ ok: true });
      return;
    }
    clearTimeout(player.hostTransferTimer);
    room.players.delete(player.id);
    socket.leave(room.code);
    socket.data.roomCode = null;
    socket.data.playerId = null;
    if (!room.players.size) {
      clearTimers(room);
      clearTimeout(room.emptyTimer);
      rooms.delete(room.code);
    } else {
      if (room.hostId === player.id) {
        const nextHost = [...room.players.values()].find(candidate => candidate.connected) ?? room.players.values().next().value;
        room.hostId = nextHost.id;
        addNotice(room, roomText(room, "host", nextHost.name), "host");
      }
      addNotice(room, roomText(room, "left", player.name), "leave");
      finishIfLastPlayer(room);
      emitRoom(room);
    }
    reply?.({ ok: true });
  });
  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const player = room.players.get(socket.data.playerId);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    addNotice(room, roomText(room, "disconnected", player.name), "leave");
    if (room.hostId === player.id) {
      player.hostTransferTimer = setTimeout(() => {
        if (player.connected || !rooms.has(room.code)) return;
        const nextHost = [...room.players.values()].find(candidate => candidate.connected);
        if (nextHost) {
          room.hostId = nextHost.id;
          addNotice(room, roomText(room, "host", nextHost.name), "host");
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

function cleanRecentQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(-300).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const id = String(item.id ?? "").replace(/^trivia-api-/, "").slice(0, 120);
    const text = String(item.prompt ?? "").trim().slice(0, 300);
    if (!id && !text) return [];
    return [{ id: id || null, question: { text } }];
  });
}
server.listen(PORT, () => console.log(`Quiz & Chill ready at http://localhost:${PORT}`));
