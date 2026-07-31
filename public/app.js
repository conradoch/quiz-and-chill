import { chillAudio } from "./audio.js?v=20260730-7";

const socket = io();
const app = document.querySelector("#app");
const pill = document.querySelector("#room-pill");
const toastStack = document.querySelector("#toast-stack");
const SESSION_KEY = "quiz-and-chill-session";
const QUESTION_HISTORY_KEY = "quiz-and-chill-question-history";
const seenNotices = new Set();
let room = null, selected = null, timer = null, deadline = 0, lastCountdownTick = null;
let previousRanks = new Map();
const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
const nameInput = document.querySelector("#name"), error = document.querySelector("#error");
const soundToggle = document.querySelector("#sound-toggle");
const musicToggle = document.querySelector("#music-toggle");
const musicVolume = document.querySelector("#music-volume");
const musicVolumeOutput = document.querySelector("#music-volume-output");
const brandLink = document.querySelector(".brand");
const leaveButton = document.querySelector("#leave-room");
const leaveDialog = document.querySelector("#leave-dialog");
const leaveMessage = document.querySelector("#leave-message");
musicVolume.value = String(Math.round(chillAudio.musicVolume * 100));
musicVolumeOutput.value = `${musicVolume.value}%`;
musicVolume.oninput = () => {
  chillAudio.setMusicVolume(Number(musicVolume.value) / 100);
  musicVolumeOutput.value = `${musicVolume.value}%`;
};
function renderMusicToggle(){
  musicToggle.textContent = chillAudio.musicMuted ? "Music off" : "Music on";
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
  soundToggle.textContent = chillAudio.muted ? "Sound off" : "Sound on";
  soundToggle.setAttribute("aria-pressed", String(chillAudio.muted));
}
renderSoundToggle();
document.addEventListener("pointerdown", () => chillAudio.unlock(), { once: true });
soundToggle.onclick = async () => {
  chillAudio.setMuted(!chillAudio.muted);
  await chillAudio.unlock();
  renderSoundToggle();
  if (!chillAudio.muted) chillAudio.select();
};

document.querySelector("#join-open").onclick = () => document.querySelector("#join-fields").classList.toggle("hidden");
document.querySelector("#create").onclick = () => {
  if (!nameInput.value.trim()) return showError("Enter your name.");
  showError("");
  const playerId = newPlayerId();
  socket.emit("room:create", { name: nameInput.value, playerId }, result => result.ok ? enter(result.code, result.playerId, nameInput.value) : showError(result.error));
};
document.querySelector("#join").onclick = () => {
  const code = document.querySelector("#code").value.trim();
  if (!nameInput.value.trim() || !code) return showError("Enter your name and room code.");
  const playerId = newPlayerId();
  socket.emit("room:join", { name: nameInput.value, code, playerId }, result => result.ok ? enter(result.code, result.playerId, nameInput.value) : showError(result.error));
};
function showError(message){ error.textContent = message; }
function newPlayerId(){ return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function enter(code, playerId, name){
  localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId, name }));
  history.replaceState(null, "", `?room=${code}`);
  pill.textContent=`ROOM · ${code}`;
  pill.classList.remove("hidden");
  leaveButton.classList.remove("hidden");
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
    ? "Your place in this match will be removed. If only one player remains, they will win the game."
    : "You will leave the current room and return to the home page.";
  leaveDialog.showModal();
}

socket.on("room:state", state => {
  const previousPhase = room?.phase;
  const changedQuestion = room?.question?.id !== state.question?.id || room?.phase !== state.phase;
  room = state;
  rememberQuestion(state.question);
  showNotices(state.notices ?? []);
  chillAudio.setScene(state.phase);
  if (changedQuestion) selected = null;
  if (state.phase === "transition" && previousPhase !== "transition") {
    state.nextLevel?.roundLabel === "Final question" ? chillAudio.finalQuestion() : chillAudio.transition();
  }
  if (state.phase === "question" && (previousPhase === "loading" || previousPhase === "lobby")) chillAudio.start();
  if (state.phase === "reveal" && previousPhase !== "reveal") {
    state.reveal.isCorrect ? chillAudio.correct() : chillAudio.incorrect();
  }
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
  app.innerHTML=`<section class="level-transition"><p class="eyebrow">BUILDING TONIGHT'S QUIZ</p><div class="level-number">…</div><h2>Picking fresh questions</h2><p class="level-message">Everyone will start together in a moment.</p></section>`;
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
  app.innerHTML = `<section class="screen">
    <div class="screen-head"><div><p class="eyebrow">WAITING ROOM</p><h2>Gather your team.</h2></div><span>${room.players.length} ${room.players.length===1?"PLAYER":"PLAYERS"}</span></div>
    <div class="invite"><div><small>INVITE WITH THIS CODE</small><br><strong>${room.code}</strong></div><button id="copy">COPY LINK</button></div>
    <div class="players">${room.players.map(p=>`<div class="player ${p.connected?"":"offline"}"><span><i class="dot"></i>${esc(p.name)}</span>${p.id===room.hostId?"<small>HOST</small>":p.connected?"":"<small>OFFLINE</small>"}</div>`).join("")}</div>
    <div class="category-picker"><div class="category-heading"><div><p class="eyebrow">TONIGHT'S CATEGORY</p><h3>${isHost?"Pick the vibe":esc(category.label)}</h3></div><p>${isHost?"Choose one topic for everyone.":"The host chose this category."}</p></div><div class="category-grid ${isHost?"":"guest-category"}">${isHost?categoryOptions.map(option=>categoryCard(option,option.key===category.key,true)).join(""):categoryCard(category,true,false)}</div></div>
    <div class="host-actions">${isHost?`<button id="start">START GAME →</button>`:"<p>Waiting for the host to start…</p>"}</div>
  </section>`;
  document.querySelector("#copy").onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${room.code}`;
    await navigator.clipboard.writeText(url); document.querySelector("#copy").textContent="COPIED!";
  };
  if(isHost) document.querySelectorAll(".category-card[data-category]").forEach(card=>card.onclick=()=>{chillAudio.select();socket.emit("category:set",{category:card.dataset.category});});
  if(isHost) document.querySelector("#start").onclick=()=>{chillAudio.start();socket.emit("game:start",{recentQuestions:readQuestionHistory()});};
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
  const isFinal=next.roundLabel==="Final question";
  app.innerHTML=`<section class="level-transition">
    <p class="eyebrow">${isFinal?"GET READY":esc(next.roundLabel.toUpperCase())}</p>
    <div class="level-number">${isFinal?"★":next.roundLabel.replace("Round ","")}</div>
    <h2>${isFinal?"Final question":"Get ready for the next level"}</h2>
    <p class="level-message">${isFinal?"One last challenge — make it count!":"Questions are worth more points!"}</p>
    <div class="value-jump"><span>QUESTION VALUE</span><strong>UP TO ${next.value} PTS</strong></div>
    <div class="phase-countdown" aria-live="polite"><strong id="phase-countdown">${secondsRemaining()}</strong><span>SECONDS</span></div>
  </section>`;
  startPhaseCountdown();
}
function renderQuestion(){
  const q=room.question, reveal=room.phase==="reveal";
  const me=room.players.find(p=>p.id===room.selfId);
  const categoryLabel=room.category?.label ?? "All categories";
  app.innerHTML=`<section class="question-wrap">
    <p class="game-category">${esc(categoryLabel.toUpperCase())}${room.questionSource==="local"?" · LOCAL FALLBACK / MIXED TOPICS":""}</p>
    <div class="question-meta"><span>${q.roundLabel.toUpperCase()} · ${q.value} PTS</span><span>${q.number} / ${q.total}</span></div>
    <div class="progress"><div id="bar" style="width:${reveal?0:100}%"></div></div>
    ${horizontalScoreboard(room.scoreboard ?? [], room.selfId)}
    <div class="question-stage"><p class="eyebrow">${esc(q.category)}</p><h2 class="question">${esc(q.prompt)}</h2>
    <div class="options">${q.options.map((o,i)=>{
      const chosen=reveal?room.reveal.selectedIndex===i:selected===i;
      const correct=reveal&&room.reveal.correctIndex===i;
      const incorrect=reveal&&!correct;
      return `<button class="option ${chosen&&!reveal?"selected":""} ${correct?"correct":""} ${chosen&&incorrect?"wrong":""} ${incorrect&&!chosen?"dimmed":""}" data-i="${i}" ${me.answered||reveal?"disabled":""}><b>${String.fromCharCode(65+i)}</b><span>${esc(o)}</span>${reveal&&correct?'<i class="answer-tag">CORRECT</i>':reveal&&chosen?'<i class="answer-tag">YOUR PICK</i>':""}</button>`;
    }).join("")}</div></div>
    ${reveal?resultCard(q):`<p class="status">${me.answered?"ANSWER LOCKED · WAITING FOR THE OTHERS…":"CHOOSE AN ANSWER"}</p>`}
    ${reveal?miniBoard(room.reveal.leaderboard):""}
  </section>`;
  document.querySelectorAll(".option:not(:disabled)").forEach(btn=>btn.onclick=()=>{selected=Number(btn.dataset.i);chillAudio.select();socket.emit("answer:submit",{optionIndex:selected});render();});
  if(!reveal){
    deadline=room.phaseEndsAt || Date.now()+q.durationMs;
    timer=setInterval(()=>{
      const remaining=Math.max(0,deadline-Date.now());
      const bar=document.querySelector("#bar");
      if(bar){
        bar.style.width=`${remaining/q.durationMs*100}%`;
        bar.classList.toggle("urgent",remaining<=3000);
      }
      const tick=Math.ceil(remaining/1000);
      if(tick<=3&&tick>0&&tick!==lastCountdownTick){lastCountdownTick=tick;chillAudio.tick(tick===1);}
    },100);
  } else startPhaseCountdown();
}
function horizontalScoreboard(rows, selfId){
  const climbed = new Set(rows.filter(row => previousRanks.has(row.id) && row.rank < previousRanks.get(row.id)).map(row => row.id));
  if (climbed.has(selfId)) chillAudio.rankUp();
  previousRanks = new Map(rows.map(row => [row.id,row.rank]));
  return `<div class="live-scoreboard" aria-label="Current standings">${rows.map(row=>`<div class="live-score ${row.id===selfId?"is-you":""} ${row.connected?"":"is-offline"} ${climbed.has(row.id)?"rank-up":""}"><span class="live-rank">#${row.rank}</span><span class="live-name">${esc(row.name)}${row.id===selfId?'<small>YOU</small>':""}</span><strong>${row.score}<small>PTS</small></strong></div>`).join("")}</div>`;
}
function resultCard(q){
  const r=room.reveal;
  const hit=r.isCorrect;
  const chosen=r.selectedText ?? "No answer";
  const correct=r.correctText ?? q.options[r.correctIndex];
  return `<div class="result-card ${hit?"result-hit":"result-miss"}">
    <div><p class="eyebrow">${hit?"✓ CORRECT ANSWER":"✕ INCORRECT ANSWER"}</p><strong>${hit?`+${r.pointsEarned} points`:"+0 points"}</strong></div>
    <div class="result-detail"><span>Your pick: <b>${esc(chosen)}</b></span><span>Correct answer: <b>${esc(correct)}</b></span></div>
  </div><p class="status">NEXT QUESTION IN <strong id="phase-countdown">${secondsRemaining()}</strong> SECONDS</p>`;
}
function secondsRemaining(){return Math.max(0,Math.ceil(((room?.phaseEndsAt??Date.now())-Date.now())/1000));}
function startPhaseCountdown(){
  const update=()=>{
    const node=document.querySelector("#phase-countdown");
    if(!node)return;
    const seconds=secondsRemaining();
    node.textContent=String(seconds);
    node.classList.toggle("countdown-pop",seconds<=3);
    if(seconds<=3&&seconds>0&&seconds!==lastCountdownTick){lastCountdownTick=seconds;chillAudio.tick(seconds===1);}
  };
  update();
  timer=setInterval(update,100);
}
function miniBoard(rows){return `<div class="leaderboard">${rows.slice(0,5).map(r=>`<div class="score-row"><span>${r.rank}. ${esc(r.name)}</span><b>${r.score} PTS</b></div>`).join("")}</div>`}
function leaveToHome(){
  clearInterval(timer);
  localStorage.removeItem(SESSION_KEY);
  room = null;
  selected = null;
  pill.classList.add("hidden");
  leaveButton.classList.add("hidden");
  toastStack.replaceChildren();
  const homeUrl = new URL("/", location.origin).href;
  let navigated = false;
  const navigate = () => {
    if (navigated) return;
    navigated = true;
    location.replace(homeUrl);
  };
  socket.emit("room:leave", navigate);
  setTimeout(navigate, 600);
}
function renderFinished(){
  const winner=room.leaderboard[0];
  const isHost=room.canManageRoom ?? (room.selfId===room.hostId);
  app.innerHTML=`<section class="screen final-title"><p class="eyebrow">FINAL RESULTS</p><h2>And the winner is…</h2><h2 class="winner">${esc(winner.name)}</h2><p>${winner.score} points</p>${miniBoard(room.leaderboard)}<div class="replay-actions">${isHost?'<button id="play-again">PLAY AGAIN</button>':'<p>Waiting for the host to start another game…</p>'}<button id="go-home" class="home-button">BACK TO HOME</button></div></section>`;
  if(isHost) document.querySelector("#play-again").onclick=()=>socket.emit("game:restart");
  document.querySelector("#go-home").onclick=leaveToHome;
}

const linkedCode = new URLSearchParams(location.search).get("room");
if(linkedCode){ document.querySelector("#join-fields").classList.remove("hidden"); document.querySelector("#code").value=linkedCode.toUpperCase(); }
