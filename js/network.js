// =====================================================
// network.js — WebSocket, Lobby, Char Select, Sync
// Owner: Person 1 (Backend & Networking)
// =====================================================
'use strict';

// ── Identity & connection ────────────────────────
let ws = null, wsOk = false;
const myId = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
let roomCode = '', myName = 'PLAYER', myTeam = '', myCharIdx = -1;
let lobby = {}, isHost = false;
const MAX_PLAYERS = 4;
let matchMode = 2; // 1 = 1v1, 2 = 2v2

// ── Mode toggle ──────────────────────────────────
function setMode(m){
  if(!isHost) return;
  matchMode = m;
  send({type:'SET_MODE', mode:m});
  applyMode(m);
}
function applyMode(m){
  matchMode = m;
  document.getElementById('maxTxt').textContent = m===1?'2':'4';
  document.getElementById('mode1v1Btn').style.borderColor = m===1?'#ffd700':'';
  document.getElementById('mode1v1Btn').style.color       = m===1?'#ffd700':'';
  document.getElementById('mode2v2Btn').style.borderColor = m===2?'#ffd700':'';
  document.getElementById('mode2v2Btn').style.color       = m===2?'#ffd700':'';
  updateLst();
}

// ── WebSocket connection ─────────────────────────
function setSt(msg,cls){ const e=document.getElementById('srvSt'); e.textContent=msg; e.className='srv-st '+(cls||''); }

function connectWS(){
  const url = document.getElementById('wsUrl').value.trim();
  if(!url){ setSt('Enter a URL first','err'); return; }
  setSt('CONNECTING...','cn');
  try{ ws = new WebSocket(url); } catch(e){ setSt('Bad URL','err'); return; }
  ws.onopen    = ()=>{ wsOk=true; setSt('✓ CONNECTED','ok'); document.getElementById('playBtn').disabled=false; };
  ws.onclose   = ()=>{ wsOk=false; setSt('DISCONNECTED','err'); document.getElementById('playBtn').disabled=true; };
  ws.onerror   = ()=> setSt('ERROR — check URL','err');
  ws.onmessage = e=>{ try{ onMsg(JSON.parse(e.data)); }catch(x){ console.error(x); } };
}

function send(msg){
  if(ws && ws.readyState===1) ws.send(JSON.stringify({...msg, _from:myId}));
}

// ── Screen helpers ───────────────────────────────
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>{ if(s) s.classList.remove('on'); });
  const el = id ? document.getElementById(id) : null;
  if(el) el.classList.add('on');
}
function showGame(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  gc.style.display = mmC.style.display = 'block';
  fogC.style.display = 'none'; // fog now drawn on gc directly
  document.getElementById('hud').style.display  = 'flex';
  document.getElementById('ntag').style.display = 'block';
}
function goLobby(){ showScreen('sLobby'); }

// ── Lobby ────────────────────────────────────────
function createRoom(){
  myName = (document.getElementById('nameInp').value.trim().toUpperCase()||'PLAYER').slice(0,10);
  roomCode = Math.random().toString(36).slice(2,8).toUpperCase();
  isHost = true; lobby = {};
  lobby[myId] = {name:myName, team:'', charIdx:-1};
  document.getElementById('lcval').textContent   = roomCode;
  document.getElementById('ljoin').style.display = 'none';
  document.getElementById('lroom').style.display = 'block';
  send({type:'JOIN_ROOM', room_code:roomCode, name:myName});
  refreshLobby(); updateLst();
}

function joinRoom(){
  myName = (document.getElementById('nameInp').value.trim().toUpperCase()||'PLAYER').slice(0,10);
  roomCode = document.getElementById('codeInp').value.trim().toUpperCase().slice(0,6);
  if(!roomCode){ alert('Enter a room code!'); return; }
  isHost = false; lobby = {};
  lobby[myId] = {name:myName, team:'', charIdx:-1};
  document.getElementById('lcval').textContent   = roomCode;
  document.getElementById('ljoin').style.display = 'none';
  document.getElementById('lroom').style.display = 'block';
  send({type:'JOIN_ROOM', room_code:roomCode, name:myName});
  send({type:'ANNOUNCE',  name:myName, data:lobby[myId]});
  refreshLobby(); updateLst();
}

function pickTeam(t){
  const teamMax   = matchMode===1 ? 1 : 2;
  const teamCount = Object.values(lobby).filter(p=>p.team===t).length;
  if(teamCount >= teamMax){
    const el = document.getElementById('lst');
    el.className='lst err';
    el.textContent=`TEAM ${t} IS FULL (${teamMax}/${teamMax})`;
    setTimeout(()=>updateLst(), 2000);
    return;
  }
  myTeam = t; lobby[myId].team = t;
  send({type:'LUPDATE', pid:myId, data:{name:myName, team:t, charIdx:myCharIdx}});
  refreshLobby(); updateLst();
  if(isHost) checkReady();
}

// ── Message router ───────────────────────────────
function onMsg(m){
  if(m._from === myId) return;

  if(m.type==='SET_MODE'){
    applyMode(m.mode);

  } else if(m.type==='ANNOUNCE'){
    const maxP = matchMode===1 ? 2 : 4;
    if(Object.keys(lobby).length >= maxP){
      if(isHost) send({type:'ROOM_FULL', mode:matchMode});
      return;
    }
    lobby[m._from] = {name:m.name, team:'', charIdx:-1, ...(m.data||{})};
    if(isHost) send({type:'LFULL', lobby, mode:matchMode});
    refreshLobby(); updateLst();
    if(isHost) checkReady();

  } else if(m.type==='ROOM_FULL'){
    alert(`Room is full (${m.mode===1?'1v1 — 2':'2v2 — 4'} players max)!`);
    showScreen('sLobby');
    document.getElementById('ljoin').style.display = 'block';
    document.getElementById('lroom').style.display = 'none';

  } else if(m.type==='LFULL'){
    const maxP = m.mode===1 ? 2 : 4;
    if(Object.keys(m.lobby).length > maxP) return;
    Object.assign(lobby, m.lobby);
    lobby[myId] = {name:myName, team:myTeam, charIdx:myCharIdx};
    if(m.mode) applyMode(m.mode);
    refreshLobby(); updateLst();

  } else if(m.type==='LUPDATE'){
    if(!lobby[m._from]) lobby[m._from]={};
    Object.assign(lobby[m._from], m.data);
    refreshLobby(); updateLst();
    if(isHost) checkReady();

  } else if(m.type==='GO_SELECT'){
    if(m.mode) applyMode(m.mode);
    showScreen('sSelect'); renderCards();

  } else if(m.type==='CHAR_PICK'){
    if(!lobby[m._from]) lobby[m._from]={name:'?',team:'',charIdx:-1};
    lobby[m._from].charIdx = m.charIdx;
    refreshSelectUI();
    if(isHost) checkAllPicked();

  } else if(m.type==='GO_GAME'){
    startClient(m.st);

  } else if(m.type==='INPUT'){
    if(isHost && gs && gs.players[m._from]){
      const p = gs.players[m._from];
      p._k = m.keys;
      if(m.keys._aim !== undefined) p.aimAngle = m.keys._aim;
    }

  } else if(m.type==='SS'){
    if(!isHost && gs) mergeState(m.s);

  } else if(m.type==='ABILITY'){
    if(isHost && gs){ const p=gs.players[m._from]; if(p) doAbility(p, m.slot); }

  } else if(m.type==='REND'){
    if(!isHost){ score=m.score; roundN=m.rn; showROver(m.winner, m.score, m.rn); }

  } else if(m.type==='NR'){
    if(!isHost){
      if(m.rn) roundN = m.rn;
      document.getElementById('rover').style.display = 'none';
      document.getElementById('kf').innerHTML  = '';
      document.getElementById('elog').innerHTML = '';
      gamePaused = false;
      startClient(m.st);
    }

  } else if(m.type==='KF'){ addKF(m.text, m.color);
  } else if(m.type==='FX'){ addFX(m.text); }
}

// ── Lobby UI helpers ─────────────────────────────
function refreshLobby(){
  const c = document.getElementById('lplayers'); c.innerHTML='';
  Object.entries(lobby).forEach(([pid,p])=>{
    const r  = document.createElement('div'); r.className='lpl';
    const dot= document.createElement('div'); dot.className='ldot';
    dot.style.background = p.team==='A'?'#e63946':p.team==='B'?'#00d4ff':'#333';
    const nm = document.createElement('span');
    nm.textContent = (pid===myId?'★ ':'')+p.name;
    nm.style.color = pid===myId?'#ffd700':'#fff';
    const tm = document.createElement('span');
    tm.style.cssText = 'margin-left:auto;font-size:9px;letter-spacing:3px';
    tm.style.color   = p.team==='A'?'#e63946':p.team==='B'?'#00d4ff':'#444';
    tm.textContent   = p.team ? 'TEAM '+p.team : 'NO TEAM';
    r.appendChild(dot); r.appendChild(nm); r.appendChild(tm); c.appendChild(r);
  });
}

function updateLst(){
  const ps = Object.values(lobby);
  const a  = ps.filter(p=>p.team==='A').length;
  const b  = ps.filter(p=>p.team==='B').length;
  const perTeam = matchMode===1?1:2;
  const el = document.getElementById('lst');
  el.className='lst';
  el.textContent=`${ps.length}/${perTeam*2} PLAYERS · A:${a}/${perTeam}  B:${b}/${perTeam}`;
}

function checkReady(){
  const ps      = Object.values(lobby);
  const perTeam = matchMode===1?1:2;
  const a = ps.filter(p=>p.team==='A').length;
  const b = ps.filter(p=>p.team==='B').length;
  const el = document.getElementById('lst');
  if(a>=perTeam && b>=perTeam){
    el.className='lst ok'; el.textContent='✓ FULL — STARTING AGENT SELECT...';
    setTimeout(()=>{
      send({type:'GO_SELECT', mode:matchMode});
      showScreen('sSelect'); renderCards();
    }, 1500);
  }
}

// ── Character select ─────────────────────────────
function renderCards(){
  const c = document.getElementById('scards'); c.innerHTML='';
  CHARS.forEach((ch,i)=>{
    const d = document.createElement('div'); d.className='card';
    d.innerHTML=`
      <div class="cem">${ch.emoji}</div>
      <div class="cnm" style="color:${ch.color}">${ch.name}</div>
      <div class="crl">${ch.role}</div>
      <div class="cds">${ch.desc}</div>
      <div class="cst">
        <div class="cs"><span>HP</span><span style="color:${ch.color}">${ch.hp}</span></div>
        <div class="cs"><span>SPD</span><span style="color:${ch.color}">${ch.speed}</span></div>
        <div class="cs"><span>AMMO</span><span style="color:${ch.color}">${ch.ammo}</span></div>
      </div>
      <div class="cabs">${ch.abilities.map(a=>`
        <div class="cab"><span class="cabk">${a.key}</span>
          <div><span class="cabn">${a.name} ${a.emoji}</span><span class="cabd">${a.desc}</span></div>
        </div>`).join('')}
      </div>`;
    d.addEventListener('click',()=>pickChar(i));
    c.appendChild(d);
  });
  document.getElementById('ssub').textContent = myName+' · TEAM '+myTeam+' — PICK YOUR AGENT';
  refreshSelectUI();
}

function pickChar(i){
  myCharIdx=i; lobby[myId].charIdx=i;
  send({type:'CHAR_PICK', charIdx:i});
  refreshSelectUI();
  if(isHost) checkAllPicked();
}

function refreshSelectUI(){
  document.querySelectorAll('.card').forEach((c,i)=>c.classList.toggle('mine',i===myCharIdx));
  const picked = Object.values(lobby).filter(p=>p.charIdx>=0).length;
  const total  = Object.values(lobby).length;
  const el = document.getElementById('swait');
  el.textContent = `${picked}/${total} AGENTS SELECTED`;
  el.className   = picked===total ? 'swait ok' : 'swait';
}

function checkAllPicked(){
  if(!isHost) return;
  const ps     = Object.values(lobby);
  const needed = matchMode===1 ? 2 : 4;
  if(ps.length>=needed && ps.every(p=>p.charIdx>=0)){
    setTimeout(()=>{ const st=buildState(); send({type:'GO_GAME',st}); startHost(st); }, 600);
  }
}

// ── State sync ───────────────────────────────────
function slim(){
  const pl={};
  Object.entries(gs.players).forEach(([id,p])=>{ const{_k,...r}=p; pl[id]=r; });
  return {
    players: pl,
    projs:   gs.projs.map(p=>({owner:p.owner,x:p.x,y:p.y,vx:p.vx,vy:p.vy,size:p.size,dmg:p.dmg,color:p.color,life:p.life,bounce:p.bounce,trail:[]})),
    parts:   [],   // not synced — clients generate locally
    zones:   gs.zones,
    decoys:  gs.decoys,
    score:   gs.score,
    tick:    gs.tick,
    ended:   gs.ended
  };
}

function mergeState(s){
  Object.entries(s.players).forEach(([id,rp])=>{
    if(gs.players[id]){
      const savedKeys = gs.players[id]._k;
      const savedAim  = gs.players[id].aimAngle;
      Object.assign(gs.players[id], rp);
      gs.players[id]._k = savedKeys;
      if(id===myId) gs.players[id].aimAngle = savedAim;
      const ch = CHARS.find(c=>c.id===rp.charId) || CHARS[0];
      gs.players[id].abilities = ch.abilities;
    }
  });
  gs.projs  = s.projs;
  gs.zones  = s.zones;
  gs.decoys = s.decoys;
  gs.score  = s.score;
  gs.tick   = s.tick;
  gs.ended  = s.ended;
}

// ── Game loops ───────────────────────────────────
function hostTick(){
  const p1 = gs.players[myId];
  if(p1 && !gamePaused){
    const k = buildServerKeys();
    p1._k = k;
    if(k._aim !== undefined) p1.aimAngle = k._aim;
  }
  if(!gs.ended && !gamePaused){
    hostUpdate();
    if(gs.tick%3===0) send({type:'SS', s:slim()});
  }
  drawFrame();
  raf = requestAnimationFrame(hostTick);
}

let _lastInputSend = 0;
function clientTick(){
  if(!gamePaused){
    const k  = buildServerKeys();
    const me = gs && gs.players[myId];
    if(me && k._aim !== undefined){
      me.aimAngle = k._aim;
      me.facR     = Math.cos(k._aim) >= 0;
    }
    const now = performance.now();
    if(now - _lastInputSend >= 50){
      send({type:'INPUT', keys:k});
      _lastInputSend = now;
    }
  }
  drawFrame();
  raf = requestAnimationFrame(clientTick);
}

function sendAb(slot){
  if(isHost){ const me=gs.players[myId]; if(me) doAbility(me,slot); }
  else send({type:'ABILITY', slot});
}

// ── Notification helpers ─────────────────────────
function addKF(text,color){
  const el=document.createElement('div'); el.className='kfe'; el.textContent=text; el.style.color=color||'#fff';
  document.getElementById('kf').appendChild(el); setTimeout(()=>el.remove(),3000);
}
function addFX(text){
  const el=document.createElement('div'); el.className='ele'; el.textContent=text;
  document.getElementById('elog').appendChild(el); setTimeout(()=>el.remove(),2000);
}
function bfx(text){ addFX(text); send({type:'FX',text}); }

// ── Auto-fill WS URL from page hostname ──────────
(function(){
  const h = location.hostname;
  if(h && h!=='localhost' && h!=='127.0.0.1'){
    const proto = location.protocol==='https:' ? 'wss:' : 'ws:';
    document.getElementById('wsUrl').value = proto+'//'+h;
  }
})();
