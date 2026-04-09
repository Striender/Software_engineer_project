// =====================================================
// ui.js — Rendering, HUD, Fog of War, Pause, Keybinds
// Owner: Person 3 (UI / Rendering)
// =====================================================
'use strict';

// ── Camera ───────────────────────────────────────
let camX=0, camY=0;

// Convert world position to screen position
function w2s(wx, wy){ return {x: wx-camX, y: wy-camY}; }
// Convert screen position to world position
function s2w(sx, sy){ return {x: sx+camX, y: sy+camY}; }
// Mouse position in world coords
function mouseWorld(){ return s2w(mouseX, mouseY); }

function updateCamera(W, H){
  const me = gs && gs.players[myId];
  if(!me) return;
  const SW = gc.width, SH = gc.height;
  camX = Math.max(0, Math.min(gs.W - SW, me.x - SW/2));
  camY = Math.max(0, Math.min(gs.H - SH, me.y - SH/2));
}
let equippedAbility = null; // null | 'Q' | 'E' | 'R'
const gc   = document.getElementById('gc');
const gctx = gc.getContext('2d');
const fogC = document.getElementById('fogC');
const fogX = fogC.getContext('2d');
const mmC  = document.getElementById('mmC');
const mmX  = mmC.getContext('2d');

// rsz defined in engine.js

// ── Mouse & focus tracking ───────────────────────
let windowFocused = true;
let mouseX=0, mouseY=0;

window.addEventListener('focus', ()=>{ windowFocused=true; });
window.addEventListener('blur',  ()=>{ windowFocused=false; keys={}; });

document.addEventListener('mousemove', e=>{ mouseX=e.clientX; mouseY=e.clientY; });

// Track mouse buttons for game use
document.addEventListener('mousedown', e=>{
  // Right click — cancel equipped ability
  if(e.button===2 && equippedAbility){ equippedAbility=null; return; }
  // Left click — fire equipped ability
  if(e.button===0 && equippedAbility && gs && !listeningFor){
    const me=gs.players[myId];
    if(me && me.alive && me.cooldowns[equippedAbility]===0){
      sendAb(equippedAbility);
      equippedAbility=null;
    }
    return;
  }
  // Normal game key tracking (don't track LMB for shooting if ability equipped)
  if(gs && !listeningFor && !(e.button===0 && equippedAbility)) keys['Mouse'+e.button]=true;
});

// Capture bindings on mouseup — but only AFTER the opening click's
// mouseup has already fired (listeningReady is set in startListen
// via a requestAnimationFrame, guaranteeing at least one full event
// loop cycle passes before we accept input)
document.addEventListener('mouseup', e=>{
  keys['Mouse'+e.button]=false;
  if(listeningFor && listeningReady){
    const mk='Mouse'+e.button;
    KB[listeningFor]=mk;
    document.getElementById('kbk_'+listeningFor).textContent=fmtKey(mk);
    document.getElementById('kbk_'+listeningFor).classList.remove('listening');
    listeningFor=null; listeningReady=false;
    e.preventDefault();
  }
});

document.addEventListener('contextmenu', e=>{ if(gs||listeningFor) e.preventDefault(); });

document.addEventListener('keydown', e=>{
  if(listeningFor){
    e.preventDefault();
    KB[listeningFor]=e.key;
    document.getElementById('kbk_'+listeningFor).textContent=fmtKey(e.key);
    document.getElementById('kbk_'+listeningFor).classList.remove('listening');
    listeningFor=null; return;
  }
  if(!windowFocused) return;
  if(e.key==='Escape'){
    if(equippedAbility){ equippedAbility=null; return; } // cancel equipped
    if(gs) togglePause();
    return;
  }
  keys[e.key]=true;
  if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key)) e.preventDefault();
  if(!gs) return;
  const me=gs.players[myId]; if(!me||!me.alive) return;

  // Ability equip — press key to equip, press again to cancel
  const abKeys = [
    {kb:KB.ab1, slot:'Q'},
    {kb:KB.ab2, slot:'E'},
    {kb:KB.ab3, slot:'R'},
  ];
  for(const {kb,slot} of abKeys){
    if(e.key.toLowerCase()===kb.toLowerCase()||e.key===kb){
      if(equippedAbility===slot){ equippedAbility=null; } // toggle off
      else if(me.cooldowns[slot]===0){ equippedAbility=slot; } // equip
      return;
    }
  }

  // Tester P2 abilities (still instant for dummy)
  if(testerMode){
    const p2=gs.players['tester_p2'];
    if(p2&&p2.alive){
      if(e.key===KB2.ab1) doAbility(p2,'Q');
      if(e.key===KB2.ab2) doAbility(p2,'E');
      if(e.key===KB2.ab3) doAbility(p2,'R');
    }
  }
});
document.addEventListener('keyup', e=>{ keys[e.key]=false; });


// ── Keybind screen ───────────────────────────────
const KB_LABELS = { up: 'Move Up', down: 'Move Down', left: 'Move Left', right: 'Move Right', fire: 'Fire / Shoot', ab1: 'Ability Q', ab2: 'Ability E', ab3: 'Ability R' };

function goKeys() { showScreen('sKeys'); renderKeyGrid(); }

function renderKeyGrid() {
  const grid = document.getElementById('kbGrid'); grid.innerHTML = '';
  Object.entries(KB_LABELS).forEach(([id, label]) => {
    const row = document.createElement('div'); row.className = 'kb-row';
    const lbl = document.createElement('div'); lbl.className = 'kb-label'; lbl.textContent = label;
    const btn = document.createElement('div'); btn.className = 'kb-key'; btn.id = 'kbk_' + id; btn.textContent = fmtKey(KB[id]);
    btn.addEventListener('click', () => startListen(id));
    row.appendChild(lbl); row.appendChild(btn); grid.appendChild(row);
  });
}

function fmtKey(k) {
  if (!k) return '—'; if (k === ' ') return 'SPACE';
  if (k === 'ArrowUp') return '↑'; if (k === 'ArrowDown') return '↓';
  if (k === 'ArrowLeft') return '←'; if (k === 'ArrowRight') return '→';
  if (k === 'Mouse0') return 'LMB 🖱'; if (k === 'Mouse1') return 'MMB 🖱'; if (k === 'Mouse2') return 'RMB 🖱';
  return k.toUpperCase();
}

function startListen(id) {
  if (listeningFor) document.getElementById('kbk_' + listeningFor).classList.remove('listening');
  listeningFor = id;
  listeningReady = false;
  document.getElementById('kbk_' + id).classList.add('listening');
  document.getElementById('kbk_' + id).textContent = 'press key or click...';
  // Double rAF: first frame lets the opening click's mouseup fire,
  // second frame sets ready so the NEXT click is captured
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { listeningReady = true; });
  });
}

// ── Name tag ─────────────────────────────────────
function setupNtag() {
  const n = document.getElementById('ntag');
  n.innerHTML = `${myName} · TEAM ${myTeam} <span style="font-size:8px;color:#333;letter-spacing:2px">· ESC=PAUSE</span>`;
  n.style.borderColor = myTeam === 'A' ? '#e63946' : '#00d4ff';
  n.style.color = myTeam === 'A' ? '#e63946' : '#00d4ff';
}
