import { chillAudio } from "./audio.js?v=20260731-11";

const PRODUCT_MODE = location.hostname.toLowerCase().startsWith("football.") || /^\/football\/?$/.test(location.pathname)
  ? "football"
  : "standard";
const SOCKET_CONNECT_TIMEOUT_MS = 20000;
const SOCKET_ACK_TIMEOUT_MS = 10000;
const socket = io({
  // Railway occasionally returns a transient 502 on Engine.IO polling. Try
  // WebSocket first, retain polling as a compatibility fallback, and let the
  // manager retry instead of treating the first transport error as terminal.
  transports: ["websocket", "polling"],
  tryAllTransports: true,
  timeout: SOCKET_CONNECT_TIMEOUT_MS,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
});
const app = document.querySelector("#app");
let homeMarkup;
const pill = document.querySelector("#room-pill");
const toastStack = document.querySelector("#toast-stack");
const SESSION_KEY = "quiz-and-chill-session";
const QUESTION_HISTORY_KEY = "quiz-and-chill-question-history";
const FOOTBALL_LANGUAGE_KEY = "quiz-and-chill-football-language";
const seenNotices = new Set();
let room = null, selected = null, timer = null, deadline = 0, lastCountdownTick = null;
let previousRanks = new Map();
let lastAnimatedQuestionId = null;
let lastScoreGainQuestionId = null;
const savedFootballLanguage = (() => {
  try { return localStorage.getItem(FOOTBALL_LANGUAGE_KEY); }
  catch { return null; }
})();
let homeMode = PRODUCT_MODE;
let homeLanguage = PRODUCT_MODE === "football" && savedFootballLanguage !== "en" ? "es" : "en";
const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
const spanish = () => room ? room.language === "es" : PRODUCT_MODE === "football" && homeLanguage === "es";
const tr = (en, es) => spanish() ? es : en;
let nameInput, error;
const soundToggle = document.querySelector("#sound-toggle");
const musicToggle = document.querySelector("#music-toggle");
const musicVolume = document.querySelector("#music-volume");
const musicVolumeOutput = document.querySelector("#music-volume-output");
const brandLink = document.querySelector(".brand");
const leaveButton = document.querySelector("#leave-room");
const leaveDialog = document.querySelector("#leave-dialog");
const leaveMessage = document.querySelector("#leave-message");

function productHomeUrl(mode) {
  if (mode === "football") {
    return location.hostname.toLowerCase().startsWith("football.")
      ? new URL("/", location.origin)
      : new URL("/football", location.origin);
  }
  return location.hostname.toLowerCase().startsWith("football.")
    ? new URL("https://quizandchill.fun/")
    : new URL("/", location.origin);
}

function applyProductChrome(mode) {
  const football = mode === "football";
  document.body.dataset.gameMode = mode;
  document.body.dataset.product = mode;
  brandLink.href = productHomeUrl(mode).href;
  brandLink.innerHTML = football ? '<span class="brand-ball" aria-hidden="true">⚽</span> Football Night' : 'Quiz <span>&amp;</span> Chill';
  document.title = football ? "Football Night — Quiz & Chill" : "Quiz & Chill — Trivia with friends";
  document.querySelector("#theme-color").content = football ? "#071a1c" : "#15152c";
}

function configureProductHome() {
  applyProductChrome(PRODUCT_MODE);
  const football = PRODUCT_MODE === "football";
  const languagePicker = app.querySelector("#product-language-picker");
  if (football) {
    languagePicker.classList.remove("hidden");
  } else {
    languagePicker.remove();
    document.querySelector("#page-description").content = "Real-time multiplayer general trivia for friends.";
  }
  const switchLink = document.createElement("a");
  switchLink.id = "product-switch";
  switchLink.className = "product-switch";
  switchLink.href = productHomeUrl(football ? "standard" : "football").href;
  app.querySelector(".entry-card").append(switchLink);
  applyHomeLanguage();
  homeMarkup = app.innerHTML;
}

function applyHomeLanguage() {
  const football = PRODUCT_MODE === "football";
  const isSpanish = football && homeLanguage === "es";
  document.documentElement.lang = isSpanish ? "es" : "en";
  if (!app.querySelector("#home-title")) return;

  if (football) {
    app.querySelector("#home-eyebrow").textContent = isSpanish ? "FÚTBOL BAJO LAS LUCES" : "FOOTBALL UNDER THE LIGHTS";
    app.querySelector("#home-title").innerHTML = isSpanish ? "Sabé de fútbol.<br><em>Ganate la noche.</em>" : "Know football.<br><em>Own the night.</em>";
    app.querySelector("#home-lede").textContent = isSpanish ? "Desafiá a tus amigos y demostrá quién sabe más de fútbol." : "Challenge your friends and prove who knows football best.";
    app.querySelector("#home-proof").innerHTML = isSpanish
      ? "<span>01 · 3 RONDAS</span><span>02 · SOLO FÚTBOL</span><span>03 · UN GANADOR</span>"
      : "<span>01 · 3 ROUNDS</span><span>02 · FOOTBALL ONLY</span><span>03 · ONE WINNER</span>";
    document.querySelector("#page-description").content = isSpanish
      ? "Una noche de trivia de fútbol multijugador en tiempo real."
      : "A real-time multiplayer football trivia night.";
    document.querySelector("#question-credit").textContent = isSpanish
      ? "Las preguntas de Football Night se seleccionan localmente a partir de fuentes históricas de fútbol revisadas."
      : "Football Night questions are curated locally from reviewed historical football sources.";
    document.title = isSpanish ? "Football Night — Trivia de fútbol" : "Football Night — Quiz & Chill";
  }

  const pickerTitle = app.querySelector("#language-picker-title");
  if (pickerTitle) pickerTitle.textContent = isSpanish ? "IDIOMA" : "LANGUAGE";
  app.querySelector("#name-label").textContent = isSpanish ? "TU NOMBRE" : "YOUR NAME";
  app.querySelector("#name").placeholder = isSpanish ? "Conrado" : "Conrad";
  app.querySelector("#create-label").textContent = isSpanish ? "CREAR SALA" : "CREATE ROOM";
  app.querySelector("#join-open").textContent = isSpanish ? "ENTRAR CON CÓDIGO" : "JOIN WITH CODE";
  app.querySelector("#code-label").textContent = isSpanish ? "CÓDIGO DE SALA" : "ROOM CODE";
  app.querySelector("#join").textContent = isSpanish ? "ENTRAR" : "JOIN";
  document.querySelector(".music-volume span").textContent = isSpanish ? "Volumen" : "Music volume";
  document.querySelector("#credits-open").textContent = isSpanish ? "Créditos y licencias" : "Credits & Licenses";
  const switchLink = app.querySelector("#product-switch");
  if (switchLink) switchLink.textContent = football
    ? (isSpanish ? "¿Preferís trivia general? Jugá Quiz & Chill →" : "Prefer general trivia? Play Quiz & Chill →")
    : "Love football? Enter Football Night →";
  renderMusicToggle();
  renderSoundToggle();
}

configureProductHome();
musicVolume.value = String(Math.round(chillAudio.musicVolume * 100));
musicVolumeOutput.value = `${musicVolume.value}%`;
musicVolume.oninput = () => {
  chillAudio.setMusicVolume(Number(musicVolume.value) / 100);
  musicVolumeOutput.value = `${musicVolume.value}%`;
};
function renderMusicToggle(){
  musicToggle.textContent = chillAudio.musicMuted ? tr("Music off", "Música off") : tr("Music on", "Música on");
  musicToggle.setAttribute("aria-pressed", String(chillAudio.musicMuted));
}
renderMusicToggle();
musicToggle.onclick = async () => {
  await chillAudio.unlock();
  chillAudio.setMusicMuted(!chillAudio.musicMuted);
  renderMusicToggle();
};
const creditsDialog = document.querySelector("#credits-dialog");
document.querySelector("#credits-open").onclick = () => creditsDialog.showModal();
document.querySelector("#credits-close").onclick = () => creditsDialog.close();
creditsDialog.onclick = event => {
  if (event.target === creditsDialog) creditsDialog.close();
};

function renderSoundToggle(){
  soundToggle.textContent = chillAudio.muted ? tr("Sound off", "Sonido off") : tr("Sound on", "Sonido on");
  soundToggle.setAttribute("aria-pressed", String(chillAudio.muted));
}
renderSoundToggle();
// Some browsers allow media immediately; the interaction listeners provide a
// standards-compliant retry when autoplay policy requires a user gesture.
chillAudio.unlock();
const unlockAudio = () => chillAudio.unlock();
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });
soundToggle.onclick = async () => {
  chillAudio.setMuted(!chillAudio.muted);
  await chillAudio.unlock();
  renderSoundToggle();
  if (!chillAudio.muted) chillAudio.select();
};

function waitForSocketConnection(timeoutMs = SOCKET_CONNECT_TIMEOUT_MS){
  if(socket.connected)return Promise.resolve();
  socket.connect();
  return new Promise((resolve,reject)=>{
    const finish=error=>{
      clearTimeout(timeout);
      socket.off("connect",onConnect);
      error?reject(error):resolve();
    };
    const onConnect=()=>finish();
    const timeout=setTimeout(()=>finish(new Error("connection timeout")),timeoutMs);
    socket.once("connect",onConnect);
  });
}

async function emitWithAck(event,payload,ackTimeoutMs = SOCKET_ACK_TIMEOUT_MS){
  await waitForSocketConnection();
  if(!socket.connected)throw new Error("socket disconnected");
  return new Promise((resolve,reject)=>{
    socket.timeout(ackTimeoutMs).emit(event,payload,(ackError,result)=>ackError?reject(ackError):resolve(result));
  });
}

function setRoomActionBusy(button,label,busy,busyText,idleText){
  button.disabled=busy;
  button.setAttribute("aria-busy",String(busy));
  label.textContent=busy?busyText:idleText;
}

function bindHome(){
  nameInput = document.querySelector("#name");
  error = document.querySelector("#error");
  const createButton=document.querySelector("#create");
  const createLabel=document.querySelector("#create-label");
  const joinButton=document.querySelector("#join");
  const languagePanel = document.querySelector("#football-language");
  const languageButtons = [...document.querySelectorAll("[data-language]")];
  const syncHomeChoice = () => {
    document.body.dataset.gameMode = homeMode;
    languagePanel?.classList.toggle("hidden", homeMode !== "football");
    languageButtons.forEach(button => {
      const active = button.dataset.language === homeLanguage;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    applyHomeLanguage();
  };
  languageButtons.forEach(button => button.onclick = () => {
    homeLanguage = button.dataset.language === "es" ? "es" : "en";
    try { localStorage.setItem(FOOTBALL_LANGUAGE_KEY, homeLanguage); } catch {}
    chillAudio.select();
    syncHomeChoice();
  });
  syncHomeChoice();
  document.querySelector("#join-open").onclick = () => document.querySelector("#join-fields").classList.toggle("hidden");
  createButton.onclick = async () => {
    if (!nameInput.value.trim()) return showError(homeMode === "football" && homeLanguage === "es" ? "Ingresá tu nombre." : "Enter your name.");
    if(createButton.disabled)return;
    const playerName=nameInput.value.trim();
    const idleLabel=spanish()?"CREAR SALA":"CREATE ROOM";
    showError("");
    setRoomActionBusy(createButton,createLabel,true,spanish()?"CREANDO…":"CREATING…",idleLabel);
    chillAudio.createRoom();
    const playerId = newPlayerId();
    try{
      const result=await emitWithAck("room:create",{ name: playerName, playerId, gameMode: homeMode, language: homeMode === "football" ? homeLanguage : "en" });
      result?.ok?enter(result.code,result.playerId,playerName):showError(result?.error??(spanish()?"No se pudo crear la sala.":"Could not create the room."));
    }catch{
      showError(spanish()?"Se interrumpió la conexión. Intentá de nuevo.":"Connection interrupted. Try again.");
    }finally{
      if(createButton.isConnected)setRoomActionBusy(createButton,createLabel,false,"",idleLabel);
    }
  };
  joinButton.onclick = async () => {
    const code = document.querySelector("#code").value.trim();
    if (!nameInput.value.trim() || !code) return showError(spanish() ? "Ingresá tu nombre y el código de sala." : "Enter your name and room code.");
    if(joinButton.disabled)return;
    const playerName=nameInput.value.trim();
    const idleLabel=spanish()?"ENTRAR":"JOIN";
    showError("");
    setRoomActionBusy(joinButton,joinButton,true,spanish()?"ENTRANDO…":"JOINING…",idleLabel);
    const playerId = newPlayerId();
    try{
      const result=await emitWithAck("room:join",{ name: playerName, code, playerId });
      result?.ok?enter(result.code,result.playerId,playerName):showError(result?.error??(spanish()?"No se pudo entrar a la sala.":"Could not join the room."));
    }catch{
      showError(spanish()?"Se interrumpió la conexión. Intentá de nuevo.":"Connection interrupted. Try again.");
    }finally{
      if(joinButton.isConnected)setRoomActionBusy(joinButton,joinButton,false,"",idleLabel);
    }
  };
  const inviteParams = new URLSearchParams(location.search);
  const linkedCode = inviteParams.get("room");
  if(linkedCode) configureInviteJoin(linkedCode, inviteParams.get("host"));
}
function configureInviteJoin(code, hostName){
  const entryCard=app.querySelector(".entry-card");
  const isSpanish=spanish();
  const safeCode=String(code).trim().toUpperCase();
  const host=String(hostName??"").trim();
  app.querySelector("#product-language-picker")?.classList.add("hidden");
  app.querySelector("#home-proof")?.classList.add("hidden");
  app.querySelector(".actions")?.remove();
  app.querySelector("#join-fields")?.classList.remove("hidden");
  app.querySelector("#code-label").textContent=isSpanish?"SALA A LA QUE TE UNÍS":"ROOM YOU'RE JOINING";
  const codeInput=app.querySelector("#code");
  codeInput.value=safeCode;
  codeInput.readOnly=true;
  codeInput.setAttribute("aria-label",isSpanish?"Código de la sala a la que te unís":"Room code you're joining");
  app.querySelector("#name-label").textContent=isSpanish?"TU NOMBRE PARA UNIRTE":"YOUR NAME TO JOIN";
  app.querySelector("#join").textContent=isSpanish?"UNIRME A ESTA SALA":"JOIN THIS ROOM";
  const heading=host
    ? (isSpanish?`Te estás uniendo a la sala de ${host}.`:`You're joining ${host}'s room.`)
    : (isSpanish?"Te estás uniendo a una sala con invitación.":"You're joining an invited room.");
  entryCard.insertAdjacentHTML("afterbegin",`<div class="invite-join-context"><p class="eyebrow">${isSpanish?"INVITACIÓN A UNA PARTIDA":"GAME INVITATION"}</p><strong>${esc(heading)}</strong><span>${isSpanish?"Elegí tu nombre y unite para jugar.":"Choose your name, then join the game."}</span></div>`);
  const back=document.createElement("button");
  back.type="button";
  back.className="invite-back";
  back.textContent=isSpanish?"VOLVER AL INICIO":"BACK TO HOME";
  back.onclick=()=>{
    history.replaceState(null,"",location.pathname);
    app.innerHTML=homeMarkup;
    bindHome();
  };
  entryCard.append(back);
}
bindHome();
function showError(message){ error.textContent = message; }
function newPlayerId(){ return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function enter(code, playerId, name){
  localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId, name }));
  history.replaceState(null, "", `?room=${code}`);
  pill.textContent=`ROOM · ${code}`;
  pill.classList.remove("hidden");
  leaveButton.classList.remove("hidden");
}

function roomInviteUrl(roomState) {
  const url = productHomeUrl(roomState.gameMode === "football" ? "football" : "standard");
  url.searchParams.set("room", roomState.code);
  const host=roomState.players?.find(player=>player.id===roomState.hostId)?.name;
  if(host) url.searchParams.set("host",host);
  return url.href;
}
function resumeSession(){
  let session;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { localStorage.removeItem(SESSION_KEY); return; }
  if (!session?.code || !session?.playerId) return;
  socket.emit("room:resume", session, result => {
    if (result.ok) enter(result.code, result.playerId, session.name);
    else {
      localStorage.removeItem(SESSION_KEY);
      if (new URLSearchParams(location.search).get("room")) showError(result.error);
    }
  });
}
socket.on("connect", resumeSession);
if (socket.connected) resumeSession();

brandLink.onclick = event => {
  if (!room && !localStorage.getItem(SESSION_KEY)) return;
  event.preventDefault();
  requestLeave();
};
leaveButton.onclick = requestLeave;
document.querySelector("#leave-cancel").onclick = () => leaveDialog.close();
document.querySelector("#leave-confirm").onclick = () => {
  leaveDialog.close();
  leaveToHome();
};
leaveDialog.onclick = event => {
  if (event.target === leaveDialog) leaveDialog.close();
};

function requestLeave(){
  const activeGame = room && !["lobby", "finished"].includes(room.phase);
  leaveMessage.textContent = activeGame
    ? tr("Your place in this match will be removed. If only one player remains, they will win the game.", "Tu lugar en la partida será eliminado. Si queda un solo jugador, ganará la partida.")
    : tr("You will leave the current room and return to the home page.", "Abandonarás la sala y volverás a la página principal.");
  leaveDialog.showModal();
}

socket.on("room:state", state => {
  const previousPhase = room?.phase;
  const sameLiveQuestion = previousPhase === "question" && state.phase === "question" && room?.question?.id === state.question?.id;
  const changedQuestion = room?.question?.id !== state.question?.id || room?.phase !== state.phase;
  room = state;
  document.body.dataset.gameMode = state.gameMode ?? "standard";
  applyProductChrome(state.gameMode ?? "standard");
  document.documentElement.lang = state.language === "es" ? "es" : "en";
  document.title = state.gameMode === "football" ? "Football Night — Quiz & Chill" : "Quiz & Chill — Trivia with friends";
  leaveButton.textContent = tr("Leave game", "Abandonar");
  pill.textContent = `${tr("ROOM", "SALA")} · ${state.code}`;
  document.querySelector(".music-volume span").textContent = tr("Music volume", "Volumen");
  document.querySelector("#leave-dialog .eyebrow").textContent = tr("LEAVE THE ROOM?", "¿ABANDONAR LA SALA?");
  document.querySelector("#leave-title").textContent = tr("Do you wish to quit this game?", "¿Querés abandonar la partida?");
  document.querySelector("#leave-cancel").textContent = tr("STAY IN GAME", "SEGUIR JUGANDO");
  document.querySelector("#leave-confirm").textContent = tr("LEAVE GAME", "ABANDONAR");
  renderMusicToggle();
  renderSoundToggle();
  rememberQuestion(state.question);
  showNotices(state.notices ?? []);
  chillAudio.setScene(state.phase);
  if (changedQuestion) selected = null;
  if (state.phase === "transition" && previousPhase !== "transition") {
    state.nextLevel?.number === state.nextLevel?.total ? chillAudio.finalQuestion() : chillAudio.transition();
  }
  if (state.phase === "question" && previousPhase !== "question") chillAudio.start();
  if (state.phase === "reveal" && previousPhase !== "reveal") {
    state.reveal.isCorrect ? chillAudio.correct() : chillAudio.incorrect();
  }
  // Answers and presence changes broadcast fresh room state to everyone. Keep
  // the question stage and timer DOM alive, but refresh the small pieces that
  // can legitimately change during the same live question.
  if (sameLiveQuestion) return syncLiveQuestionState();
  render();
});
function showNotices(notices){
  for (const notice of notices) {
    if (seenNotices.has(notice.id)) continue;
    seenNotices.add(notice.id);
    const toast=document.createElement("div");
    toast.className=`presence-toast ${notice.type ?? "info"}`;
    toast.textContent=notice.text;
    toastStack.append(toast);
    while (toastStack.children.length > 3) toastStack.firstElementChild?.remove();
    setTimeout(()=>toast.remove(),4200);
  }
}
function render(){
  clearInterval(timer);
  lastCountdownTick = null;
  if (room.phase === "lobby") return renderLobby();
  if (room.phase === "loading") return renderLoading();
  if (room.phase === "transition") return renderTransition();
  if (room.phase === "question" || room.phase === "reveal") return renderQuestion();
  if (room.phase === "finished") return renderFinished();
}
function renderLoading(){
  app.innerHTML=`<section class="level-transition"><p class="eyebrow">${tr("BUILDING TONIGHT'S QUIZ", "PREPARANDO EL PARTIDO")}</p><div class="level-number">…</div><h2>${tr("Picking fresh questions", "Eligiendo las preguntas")}</h2><p class="level-message">${tr("Everyone will start together in a moment.", "Todos comenzarán juntos en un momento.")}</p></section>`;
}
function categoryCard(option, selected, editable){
  const artClass=`art-${option.key}`;
  const tag=editable?"button":"div";
  const attrs=editable?`type="button" data-category="${esc(option.key)}" aria-pressed="${selected}"`:`aria-label="Selected category: ${esc(option.label)}"`;
  return `<${tag} class="category-card ${selected?"selected":""} ${editable?"":"read-only"}" ${attrs}><i class="category-art ${artClass}" aria-hidden="true"><span></span></i><strong>${esc(option.label)}</strong>${selected?'<small>SELECTED</small>':""}</${tag}>`;
}
function renderLobby(){
  const isHost = room.canManageRoom ?? (room.selfId === room.hostId);
  const category = room.category ?? { key: "all", label: "All categories" };
  const categoryOptions = room.categoryOptions ?? [category];
  const footballPanel = `<div class="football-room-card"><div class="football-room-ball" aria-hidden="true">●</div><div><p class="eyebrow">FOOTBALL NIGHT</p><h3>${tr("The beautiful game takes over.", "La noche es puro fútbol.")}</h3><p>${tr("10 curated questions · English", "10 preguntas seleccionadas · Español")}</p></div><span class="language-badge">${room.language === "es" ? "ESPAÑOL" : "ENGLISH"}</span></div>`;
  const categoryPanel = `<div class="category-picker"><div class="category-heading"><div><p class="eyebrow">TONIGHT'S CATEGORY</p><h3>${isHost?"Pick the vibe":esc(category.label)}</h3></div><p>${isHost?"Choose one topic for everyone.":"The host chose this category."}</p></div><div class="category-grid ${isHost?"":"guest-category"}">${isHost?categoryOptions.map(option=>categoryCard(option,option.key===category.key,true)).join(""):categoryCard(category,true,false)}</div></div>`;
  app.innerHTML = `<section class="screen">
    <div class="screen-head"><div><p class="eyebrow">${tr("WAITING ROOM", "VESTUARIO")}</p><h2>${tr("Gather your team.", "Reuní a tu equipo.")}</h2></div><span>${room.players.length} ${room.players.length===1?tr("PLAYER","JUGADOR"):tr("PLAYERS","JUGADORES")}</span></div>
    <div class="invite"><div><small>${tr("INVITE WITH THIS CODE", "INVITÁ CON ESTE CÓDIGO")}</small><br><strong>${room.code}</strong></div><button id="copy">${tr("COPY LINK", "COPIAR LINK")}</button></div>
    <div class="players">${room.players.map(p=>`<div class="player ${p.connected?"":"offline"}"><span><i class="dot"></i>${esc(p.name)}</span>${p.id===room.hostId?`<small>${tr("HOST","ANFITRIÓN")}</small>`:p.connected?"":`<small>${tr("OFFLINE","DESCONECTADO")}</small>`}</div>`).join("")}</div>
    ${room.gameMode === "football" ? footballPanel : categoryPanel}
    ${room.questionLoadError?`<p class="service-notice" role="status"><span aria-hidden="true">·</span> ${esc(room.questionLoadError)}</p>`:""}
    <div class="host-actions">${isHost?`<button id="start">${tr("START GAME", "EMPEZAR PARTIDO")} →</button>`:`<p>${tr("Waiting for the host to start…", "Esperando que el anfitrión comience…")}</p>`}</div>
  </section>`;
  document.querySelector("#copy").onclick = async () => {
    const url = roomInviteUrl(room);
    await navigator.clipboard.writeText(url); document.querySelector("#copy").textContent=tr("COPIED!", "¡COPIADO!");
  };
  if(isHost) document.querySelectorAll(".category-card[data-category]").forEach(card=>card.onclick=()=>{chillAudio.select();socket.emit("category:set",{category:card.dataset.category});});
  if(isHost) document.querySelector("#start").onclick=()=>{chillAudio.lobbyStart();socket.emit("game:start",{recentQuestions:readQuestionHistory()});};
}
function readQuestionHistory(){
  try {
    const value=JSON.parse(localStorage.getItem(QUESTION_HISTORY_KEY));
    return Array.isArray(value)?value.slice(-300):[];
  } catch {
    localStorage.removeItem(QUESTION_HISTORY_KEY);
    return [];
  }
}
function rememberQuestion(question){
  if(!question?.id||!question?.prompt)return;
  const history=readQuestionHistory();
  const entry={id:String(question.id),prompt:String(question.prompt)};
  const filtered=history.filter(item=>item.id!==entry.id&&item.prompt!==entry.prompt);
  filtered.push(entry);
  localStorage.setItem(QUESTION_HISTORY_KEY,JSON.stringify(filtered.slice(-300)));
}
function renderTransition(){
  const next=room.nextLevel;
  const isFinal=next.number===next.total;
  app.innerHTML=`<section class="level-transition">
    <p class="eyebrow">${isFinal?tr("GET READY","PREPARATE"):esc(next.roundLabel.toUpperCase())}</p>
    <div class="level-number">${isFinal?"★":next.number===4?"2":"3"}</div>
    <h2>${isFinal?tr("Final question","Pregunta final"):tr("Get ready for the next level","Preparate para el próximo nivel")}</h2>
    <p class="level-message">${isFinal?tr("One specialist hard question — make it count!","Una pregunta difícil para especialistas. ¡Hacela valer!"):tr("Questions are worth more points!","¡Las preguntas valen más puntos!")}</p>
    <div class="value-jump"><span>${tr("QUESTION VALUE","VALOR DE LA PREGUNTA")}</span><strong>${tr("UP TO","HASTA")} ${next.value} PTS</strong></div>
    <div class="phase-countdown" aria-live="polite"><strong id="phase-countdown">${secondsRemaining()}</strong><span>${tr("SECONDS","SEGUNDOS")}</span></div>
  </section>`;
  startPhaseCountdown();
}
function renderQuestion(){
  const q=room.question, reveal=room.phase==="reveal";
  const me=room.players.find(p=>p.id===room.selfId);
  const categoryLabel=room.category?.label ?? "All categories";
  const animateEntry=q.id!==lastAnimatedQuestionId;
  if(!reveal) deadline=Number(room.phaseEndsAt)||Date.now()+q.durationMs;
  const initialProgress=reveal?0:timerProgressPercent(deadline,q.durationMs);
  const earnedPoints=Number(room.reveal?.pointsEarned)||0;
  const animateScoreGain=reveal&&earnedPoints>0&&q.id!==lastScoreGainQuestionId;
  if(reveal)lastScoreGainQuestionId=q.id;
  lastAnimatedQuestionId=q.id;
  app.innerHTML=`<section class="question-wrap">
    <p class="game-category">${esc(categoryLabel.toUpperCase())}${room.gameMode === "football" ? " · FOOTBALL NIGHT" : room.questionSource==="local"?" · LOCAL FALLBACK / MIXED TOPICS":""}</p>
    <div class="question-meta"><span>${q.roundLabel.toUpperCase()} · ${q.value} PTS</span><span>${reveal?`${tr("NEXT","SIGUIENTE")} <strong id="phase-countdown">${secondsRemaining()}</strong>s`:`${q.number} / ${q.total}`}</span></div>
    <div class="progress"><div id="bar" style="width:${initialProgress}%"></div></div>
    ${horizontalScoreboard(room.scoreboard ?? [], room.selfId, animateScoreGain?earnedPoints:0)}
    <div class="question-stage ${animateEntry?"animate-entry":""}"><p class="eyebrow">${esc(q.category)}${q.isNiche?" · SPECIALIST FINAL":""}</p><h2 class="question">${esc(q.prompt)}</h2>
    <div class="options">${q.options.map((o,i)=>{
      const chosen=reveal?room.reveal.selectedIndex===i:selected===i;
      const correct=reveal&&room.reveal.correctIndex===i;
      const incorrect=reveal&&!correct;
      return `<button class="option ${chosen&&!reveal?"selected":""} ${correct?"correct":""} ${chosen&&incorrect?"wrong":""} ${incorrect&&!chosen?"dimmed":""}" data-i="${i}" ${me.answered||reveal?"disabled":""}><b>${String.fromCharCode(65+i)}</b><span>${esc(o)}</span>${reveal?answerMarkers(i):""}${reveal&&correct?`<i class="answer-tag">${tr("CORRECT","CORRECTA")}</i>`:reveal&&chosen?`<i class="answer-tag">${tr("YOUR PICK","TU ELECCIÓN")}</i>`:""}</button>`;
    }).join("")}</div></div>
    ${reveal?"":`<p class="status">${me.answered?tr("ANSWER LOCKED · WAITING FOR THE OTHERS…","RESPUESTA CONFIRMADA · ESPERANDO AL RESTO…"):tr("CHOOSE AN ANSWER","ELEGÍ UNA RESPUESTA")}</p>`}
  </section>`;
  document.querySelectorAll(".option:not(:disabled)").forEach(btn=>btn.onclick=()=>{
    selected=Number(btn.dataset.i);
    lockAnswerSelection(btn);
    chillAudio.select();
    socket.emit("answer:submit",{optionIndex:selected});
  });
  if(!reveal){
    const updateTimerBar=()=>{
      const remaining=Math.max(0,deadline-Date.now());
      const bar=document.querySelector("#bar");
      if(bar){
        bar.style.width=`${timerProgressPercent(deadline,q.durationMs)}%`;
        bar.classList.toggle("urgent",remaining<=3000);
      }
    };
    updateTimerBar();
    timer=setInterval(updateTimerBar,100);
  } else startPhaseCountdown();
}
function answerMarkers(optionIndex){
  const markers=(room?.reveal?.answerMarkers??[]).filter(marker=>marker.selectedIndex===optionIndex);
  if(!markers.length)return "";
  const names=markers.map(marker=>marker.name).join(", ");
  return `<span class="answer-markers" aria-label="${tr("Chosen by","Elegida por")} ${esc(names)}">${markers.map(marker=>`<span class="answer-marker" title="${esc(marker.name)}">${esc(marker.initial)}</span>`).join("")}</span>`;
}
function timerProgressPercent(endAt,durationMs,now=Date.now()){
  const duration=Number(durationMs);
  const remaining=Number(endAt)-now;
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(remaining))return 0;
  return Math.max(0,Math.min(100,remaining/duration*100));
}
function lockAnswerSelection(selectedButton){
  document.querySelectorAll(".option").forEach(button=>{
    button.classList.toggle("selected",button===selectedButton);
    button.disabled=true;
  });
  const status=document.querySelector(".question-wrap .status");
  if(status)status.textContent=tr("ANSWER LOCKED · WAITING FOR THE OTHERS…","RESPUESTA CONFIRMADA · ESPERANDO AL RESTO…");
}
function syncLiveQuestionState(){
  const currentScoreboard=document.querySelector(".live-scoreboard");
  if(currentScoreboard){
    const nextScoreboard=document.createElement("template");
    nextScoreboard.innerHTML=horizontalScoreboard(room.scoreboard??[],room.selfId);
    currentScoreboard.replaceWith(nextScoreboard.content.firstElementChild);
  }
  const me=room?.players.find(player=>player.id===room.selfId);
  if(!me?.answered)return;
  document.querySelectorAll(".option").forEach(button=>button.disabled=true);
  const status=document.querySelector(".question-wrap .status");
  if(status)status.textContent=tr("ANSWER LOCKED · WAITING FOR THE OTHERS…","RESPUESTA CONFIRMADA · ESPERANDO AL RESTO…");
}
function horizontalScoreboard(rows, selfId, pointsEarned=0){
  const climbed = new Set(rows.filter(row => previousRanks.has(row.id) && row.rank < previousRanks.get(row.id)).map(row => row.id));
  if (climbed.has(selfId)) chillAudio.rankUp();
  previousRanks = new Map(rows.map(row => [row.id,row.rank]));
  return `<div class="live-scoreboard" aria-label="${tr("Current standings","Posiciones actuales")}">${rows.map(row=>{
    const isSelf=row.id===selfId;
    const showGain=isSelf&&pointsEarned>0;
    return `<div class="live-score ${isSelf?"is-you":""} ${row.connected?"":"is-offline"} ${climbed.has(row.id)?"rank-up":""} ${showGain?"score-awarded":""}"><span class="live-rank">#${row.rank}</span><span class="live-name">${esc(row.name)}${isSelf?`<small>${tr("YOU","VOS")}</small>`:""}</span><strong class="live-total">${row.score}<small>PTS</small></strong>${showGain?`<span class="score-gain" role="status" aria-live="polite" aria-label="${pointsEarned} ${tr("points earned","puntos obtenidos")}"><span aria-hidden="true">↗ +${pointsEarned}</span></span>`:""}</div>`;
  }).join("")}</div>`;
}
function secondsRemaining(){return Math.max(0,Math.ceil(((room?.phaseEndsAt??Date.now())-Date.now())/1000));}
function startPhaseCountdown(){
  const update=()=>{
    const node=document.querySelector("#phase-countdown");
    if(!node)return;
    const seconds=secondsRemaining();
    node.textContent=String(seconds);
    node.classList.toggle("countdown-pop",seconds<=3);
    if(room?.phase==="transition"&&seconds<=3&&seconds>0&&seconds!==lastCountdownTick){lastCountdownTick=seconds;chillAudio.tick(seconds);}
  };
  update();
  timer=setInterval(update,100);
}
function miniBoard(rows){return `<div class="leaderboard">${rows.slice(0,5).map(r=>`<div class="score-row"><span>${r.rank}. ${esc(r.name)}</span><b>${r.score} PTS</b></div>`).join("")}</div>`}
function leaveToHome(){
  clearInterval(timer);
  let completed = false;
  const showHome = () => {
    if (completed) return;
    completed = true;
    localStorage.removeItem(SESSION_KEY);
    room = null;
    selected = null;
    previousRanks = new Map();
    pill.classList.add("hidden");
    leaveButton.classList.add("hidden");
    toastStack.replaceChildren();
    history.replaceState(null, "", location.pathname);
    applyProductChrome(PRODUCT_MODE);
    app.innerHTML = homeMarkup;
    bindHome();
    leaveButton.textContent = "Leave game";
    renderMusicToggle();
    renderSoundToggle();
    chillAudio.setScene("home");
  };
  socket.emit("room:leave", showHome);
  // Keep the UI responsive if an acknowledgement is lost, while the server
  // will still process the explicit leave event independently.
  setTimeout(showHome, 900);
}
function renderFinished(){
  const winner=room.leaderboard[0];
  const isHost=room.canManageRoom ?? (room.selfId===room.hostId);
  app.innerHTML=`<section class="screen final-title"><p class="eyebrow">${tr("FINAL RESULTS","RESULTADOS FINALES")}</p><h2>${tr("And the winner is…","Y el ganador es…")}</h2><h2 class="winner">${esc(winner.name)}</h2><p>${winner.score} ${tr("points","puntos")}</p>${miniBoard(room.leaderboard)}<div class="replay-actions">${isHost?`<button id="play-again">${tr("PLAY AGAIN","JUGAR DE NUEVO")}</button>`:`<p>${tr("Waiting for the host to start another game…","Esperando que el anfitrión inicie otra partida…")}</p>`}<button id="go-home" class="home-button">${tr("BACK TO HOME","VOLVER AL INICIO")}</button></div></section>`;
  if(isHost) document.querySelector("#play-again").onclick=()=>socket.emit("game:restart");
  document.querySelector("#go-home").onclick=leaveToHome;
}

