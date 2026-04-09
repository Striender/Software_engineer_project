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


// ── HUD ──────────────────────────────────────────
function buildHUD() {
  if (!gs) return;
  const me = gs.players[myId]; if (!me) return;
  const myTmP = Object.values(gs.players).filter(p => p.team === myTeam);
  const enTeam = myTeam === 'A' ? 'B' : 'A';
  const enPlayers = Object.values(gs.players).filter(p => p.team === enTeam);
  const myFc = myTeam === 'A' ? 'fa' : 'fb';
  const enFc = myTeam === 'A' ? 'fb' : 'fa';
  renderMyHUD(myTeam === 'A' ? 'hudA' : 'hudB', me, myFc);
  renderEnemyHUD(myTeam === 'A' ? 'hudB' : 'hudA', enPlayers, enFc);
  document.getElementById('hscore').textContent = `${score[0]}·${score[1]}`;
  document.getElementById('hround').textContent = `ROUND ${roundN}`;
}

function renderMyHUD(id, p, fc) {
  const el = document.getElementById(id);
  const col = fc === 'fa' ? '#e63946' : '#00d4ff';
  el.innerHTML = `
    <div class="hems">${p.emoji}</div>
    <div class="hinfo">
      <div class="htn" style="color:${col}">${p.name} <span style="font-size:7px;color:#555">YOU · TEAM ${p.team}</span></div>
      <div class="hhps"><div class="hpbar" id="hpb_${p.pid}"><div class="hpfill ${fc}" style="width:100%"></div></div></div>
      <div class="ammo-row" id="ammorow_${p.pid}">
        <div class="ammo-dots" id="ammo_${p.pid}"></div>
        <div class="reload-bar-wrap" id="relbw_${p.pid}" style="display:none">
          <span class="reload-icon">↺</span>
          <div class="reload-track"><div class="reload-fill" id="relf_${p.pid}" style="width:0%"></div></div>
          <span class="reload-txt">RELOADING</span>
        </div>
      </div>
      <div class="habs" id="abs_${p.pid}">
        ${(p.abilities || []).map((a, i) => `
          <div class="habi rdy" id="ab_${p.pid}_${i}" title="${a.name}">
            <span style="font-size:20px">${a.emoji}</span>
            <span class="habi-label">${KB['ab' + (i + 1)].toUpperCase()}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderEnemyHUD(id, players, fc) {
  const el = document.getElementById(id);
  const col = fc === 'fa' ? '#e63946' : '#00d4ff';
  const team = players[0]?.team || '?';
  el.className = 'hteam r';
  el.innerHTML = `
    <div class="hems">${players.map(p => `<span title="${p.name}">${p.emoji}</span>`).join('')}</div>
    <div class="hinfo r">
      <div class="htn" style="color:${col}">TEAM ${team} <span style="font-size:7px;color:#555">ENEMIES</span></div>
      <div class="hhps">${players.map(p => `<div class="hpbar" id="hpb_${p.pid}"><div class="hpfill ${fc}" style="width:100%"></div></div>`).join('')}</div>
    </div>`;
}

function updateHUD() {
  if (!gs) return;
  const me = gs.players[myId];
  Object.values(gs.players).forEach(p => {
    const hb = document.getElementById(`hpb_${p.pid}`);
    if (hb) { const f = hb.querySelector('.hpfill'); if (f) f.style.width = (p.hp / p.maxHp * 100) + '%'; }
  });
  if (!me) return;
  const p = me;
  const ammoel = document.getElementById(`ammo_${p.pid}`);
  const relbw = document.getElementById(`relbw_${p.pid}`);
  const relf = document.getElementById(`relf_${p.pid}`);
  if (p.reloading > 0) {
    if (ammoel) ammoel.style.display = 'none';
    if (relbw) relbw.style.display = 'flex';
    const pct = ((p.reloadMax || 120) - p.reloading) / (p.reloadMax || 120) * 100;
    if (relf) relf.style.width = pct + '%';
  } else {
    if (relbw) relbw.style.display = 'none';
    if (ammoel) {
      ammoel.style.display = 'flex';
      let html = '';
      for (let i = 0; i < p.maxAmmo; i++) {
        html += (i < p.ammo)
          ? `<span class="adot" style="background:${p.color};box-shadow:0 0 3px ${p.color}88"></span>`
          : `<span class="adot spent"></span>`;
      }
      ammoel.innerHTML = html;
    }
  }
  (p.abilities || []).forEach((a, i) => {
    const el = document.getElementById(`ab_${p.pid}_${i}`); if (!el) return;
    const cd = p.cooldowns[a.key];
    const isEquipped = equippedAbility === a.key;
    if (cd > 0) {
      el.classList.remove('rdy'); el.style.outline = ''; el.style.boxShadow = '';
      el.innerHTML = `<span class="habi-cd">${Math.ceil(cd / 60)}s</span>`;
    } else {
      el.classList.add('rdy');
      el.style.outline = isEquipped ? `2px solid ${p.color}` : '';
      el.style.boxShadow = isEquipped ? `0 0 14px ${p.color}` : '';
      el.innerHTML = `<span style="font-size:20px">${a.emoji}</span><span class="habi-label">${KB['ab' + (i + 1)].toUpperCase()}</span>`;
    }
  });
  document.getElementById('hscore').textContent = `${gs.score[0]}·${gs.score[1]}`;
}

function drawFrame() {
  if (!gs) return;
  const W = gc.width, H = gc.height;

  updateCamera(W, H);

  // 1. Gray floor across full viewport
  gctx.fillStyle = '#b8b8c4'; gctx.fillRect(0, 0, W, H);

  // 3. Grid on floor
  gctx.save();
  gctx.translate(-camX, -camY); // apply camera offset for world rendering
  gctx.strokeStyle = 'rgba(80,80,100,0.3)'; gctx.lineWidth = 1;
  // Only draw grid lines visible on screen
  const gx0 = Math.floor(camX / 50) * 50, gy0 = Math.floor(camY / 50) * 50;
  for (let x = gx0; x < camX + W + 50; x += 50) { gctx.beginPath(); gctx.moveTo(x, camY); gctx.lineTo(x, camY + H); gctx.stroke(); }
  for (let y = gy0; y < camY + H + 50; y += 50) { gctx.beginPath(); gctx.moveTo(camX, y); gctx.lineTo(camX + W, y); gctx.stroke(); }
  gctx.restore();

  // 4. World rendering — apply camera offset
  gctx.save();
  gctx.translate(-camX, -camY);

  // Zones
  gs.zones.forEach(z => {
    const a = z.life / z.maxLife; gctx.save(); gctx.globalAlpha = a;
    gctx.beginPath(); gctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    gctx.fillStyle = z.color; gctx.fill();
    gctx.strokeStyle = z.border; gctx.lineWidth = 2; gctx.setLineDash([8, 5]);
    gctx.shadowColor = z.border; gctx.shadowBlur = 10; gctx.stroke();
    gctx.setLineDash([]); gctx.restore();
  });

  // Walls
  gs.walls.forEach((w, i) => {
    if (i < 4) { gctx.fillStyle = '#020208'; gctx.fillRect(w.x, w.y, w.w, w.h); return; }
    gctx.save();
    gctx.fillStyle = '#0b0b1e'; gctx.fillRect(w.x, w.y, w.w, w.h);
    gctx.strokeStyle = '#00d4ff'; gctx.lineWidth = 1.5; gctx.shadowColor = '#00d4ff'; gctx.shadowBlur = 8; gctx.strokeRect(w.x, w.y, w.w, w.h);
    gctx.shadowBlur = 0; gctx.strokeStyle = 'rgba(0,212,255,.1)'; gctx.lineWidth = 1;
    if (w.w > w.h) { for (let lx = w.x + 14; lx < w.x + w.w - 5; lx += 18) { gctx.beginPath(); gctx.moveTo(lx, w.y + 3); gctx.lineTo(lx, w.y + w.h - 3); gctx.stroke(); } }
    else { for (let ly = w.y + 14; ly < w.y + w.h - 5; ly += 18) { gctx.beginPath(); gctx.moveTo(w.x + 3, ly); gctx.lineTo(w.x + w.w - 3, ly); gctx.stroke(); } }
    gctx.restore();
  });

  // Particles
  gs.parts.forEach(p => {
    const a = p.life / p.maxLife; gctx.save(); gctx.globalAlpha = a; gctx.fillStyle = p.color;
    gctx.shadowColor = p.color; gctx.shadowBlur = 5;
    gctx.beginPath(); gctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); gctx.fill(); gctx.restore();
  });

  // Projectile trails + bullets
  gs.projs.forEach(pr => {
    (pr.trail || []).forEach(t => {
      gctx.save(); gctx.globalAlpha = (t.l / t.ml) * 0.35; gctx.fillStyle = pr.color;
      gctx.beginPath(); gctx.arc(t.x, t.y, pr.size * (t.l / t.ml), 0, Math.PI * 2); gctx.fill(); gctx.restore();
    });
    gctx.save();
    if (pr.flash) {
      // Flash orb — bright pulsing yellow ball
      gctx.shadowColor = '#ffff00'; gctx.shadowBlur = 24;
      gctx.fillStyle = '#ffffaa';
    } else {
      gctx.fillStyle = pr.color; gctx.shadowColor = pr.color; gctx.shadowBlur = 16;
    }
    gctx.beginPath(); gctx.arc(pr.x, pr.y, pr.size, 0, Math.PI * 2); gctx.fill(); gctx.restore();
  });

  // Decoys
  gs.decoys.forEach(dc => {
    const a = Math.min(1, dc.life / 50) * 0.45; gctx.save(); gctx.globalAlpha = a;
    gctx.font = `${dc.size + 4}px serif`; gctx.textAlign = 'center'; gctx.textBaseline = 'middle';
    gctx.fillText(dc.emoji, dc.x, dc.y); gctx.restore();
  });

  // Players
  Object.values(gs.players).forEach(p => { if (p.alive) drawPlayer(p); });

  // Draw fog shadows INSIDE camera transform so they're in world space
  drawFog(W, H);

  // Redraw walls ON TOP of shadows so shadows never cover walls
  gs.walls.forEach((w, i) => {
    if (i < 4) { gctx.fillStyle = '#020208'; gctx.fillRect(w.x, w.y, w.w, w.h); return; }
    gctx.save();
    gctx.fillStyle = '#0b0b1e'; gctx.fillRect(w.x, w.y, w.w, w.h);
    gctx.strokeStyle = '#00d4ff'; gctx.lineWidth = 1.5; gctx.shadowColor = '#00d4ff'; gctx.shadowBlur = 8; gctx.strokeRect(w.x, w.y, w.w, w.h);
    gctx.shadowBlur = 0; gctx.strokeStyle = 'rgba(0,212,255,.1)'; gctx.lineWidth = 1;
    if (w.w > w.h) { for (let lx = w.x + 14; lx < w.x + w.w - 5; lx += 18) { gctx.beginPath(); gctx.moveTo(lx, w.y + 3); gctx.lineTo(lx, w.y + w.h - 3); gctx.stroke(); } }
    else { for (let ly = w.y + 14; ly < w.y + w.h - 5; ly += 18) { gctx.beginPath(); gctx.moveTo(w.x + 3, ly); gctx.lineTo(w.x + w.w - 3, ly); gctx.stroke(); } }
    gctx.restore();
  });

  // Redraw smoke zones ON TOP of shadows so circle is never blackened
  gs.zones.filter(z => z.shadowR).forEach(z => {
    const a = z.life / z.maxLife;
    gctx.save(); gctx.globalAlpha = a;
    gctx.beginPath(); gctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    gctx.fillStyle = z.color; gctx.fill();
    gctx.strokeStyle = z.border; gctx.lineWidth = 2; gctx.setLineDash([8, 5]);
    gctx.shadowColor = z.border; gctx.shadowBlur = 10; gctx.stroke();
    gctx.setLineDash([]); gctx.restore();

    // Redraw players inside this smoke so they're visible through it
    Object.values(gs.players).forEach(p => {
      if (p.alive && d(p.x, p.y, z.x, z.y) < z.r) drawPlayer(p);
    });
  });

  gctx.restore(); // end camera transform — back to screen space

  // Ability preview for MY equipped ability (screen space, uses world->screen conversion)
  const _meP = gs.players[myId];
  if (_meP && _meP.alive && equippedAbility) {
    drawAbilityPreview(_meP, equippedAbility, W, H);
  }

  // Flash overlay — full screen, no camera needed
  const _me = gs.players[myId];
  if (_me && (_me.effects.flashed || 0) > 0) {
    const intensity = _me.effects.flashed / 12;
    gctx.save();
    gctx.fillStyle = `rgba(155,69,214,${intensity * 0.88})`;
    gctx.fillRect(0, 0, W, H);
    gctx.restore();
  }

  // Fog drawn last (screen space)
  // drawFog already called inside camera transform above
  drawMinimap(W, H);
  updateHUD();
}

// Per-ability preview rendering
function drawAbilityPreview(p, slot, W, H) {
  const ch = CHARS.find(c => c.id === p.charId); if (!ch) return;
  const ab = ch.abilities.find(a => a.key === slot); if (!ab) return;
  const a = p.aimAngle || 0;

  // Convert player world pos to screen pos
  const ps = w2s(p.x, p.y);
  const mw = mouseWorld();
  const maxRange = 350;
  const dist = Math.min(Math.hypot(mw.x - p.x, mw.y - p.y), maxRange);

  // Target position in screen space
  const tsx = ps.x + Math.cos(a) * dist;
  const tsy = ps.y + Math.sin(a) * dist;

  gctx.save();

  // Max range circle (screen space)
  gctx.beginPath(); gctx.arc(ps.x, ps.y, maxRange, 0, Math.PI * 2);
  gctx.strokeStyle = p.color + '44'; gctx.lineWidth = 1;
  gctx.setLineDash([6, 6]); gctx.stroke(); gctx.setLineDash([]);

  // Per-ability specific preview (all in screen space)
  if (p.charId === 'reyna') {
    const rc = '155,69,214';
    if (slot === 'Q') {
      gctx.beginPath(); gctx.arc(tsx, tsy, 10, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${rc},0.4)`; gctx.shadowColor = '#9b45d6'; gctx.shadowBlur = 14; gctx.fill();
      gctx.beginPath(); gctx.moveTo(ps.x, ps.y); gctx.lineTo(tsx, tsy);
      gctx.strokeStyle = `rgba(${rc},0.25)`; gctx.lineWidth = 1.5; gctx.setLineDash([4, 4]); gctx.stroke(); gctx.setLineDash([]);
    } else if (slot === 'E') {
      gctx.beginPath(); gctx.arc(tsx, tsy, 55, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${rc},0.12)`; gctx.fill();
      gctx.strokeStyle = `rgba(${rc},0.5)`; gctx.lineWidth = 1.5; gctx.stroke();
      gctx.beginPath(); gctx.arc(tsx, tsy, 6, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${rc},0.7)`; gctx.fill();
    } else if (slot === 'R') {
      gctx.beginPath(); gctx.arc(ps.x, ps.y, 36, 0, Math.PI * 2);
      gctx.strokeStyle = `rgba(${rc},0.7)`; gctx.lineWidth = 2; gctx.stroke();
      gctx.beginPath(); gctx.arc(ps.x, ps.y, 24, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${rc},0.15)`; gctx.fill();
    }
  } else if (p.charId === 'sage') {
    const sc = '79,195,161';
    if (slot === 'Q') {
      gctx.beginPath(); gctx.arc(ps.x, ps.y, 36, 0, Math.PI * 2);
      gctx.strokeStyle = `rgba(${sc},0.7)`; gctx.lineWidth = 2; gctx.stroke();
      gctx.beginPath(); gctx.arc(ps.x, ps.y, 24, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${sc},0.12)`; gctx.fill();
    } else if (slot === 'E') {
      const isH = Math.abs(Math.cos(a)) < 0.7;
      const bw = isH ? 90 : 12, bh = isH ? 12 : 90;
      gctx.fillStyle = `rgba(${sc},0.18)`; gctx.fillRect(tsx - bw / 2, tsy - bh / 2, bw, bh);
      gctx.strokeStyle = `rgba(${sc},0.7)`; gctx.lineWidth = 2; gctx.strokeRect(tsx - bw / 2, tsy - bh / 2, bw, bh);
      gctx.beginPath(); gctx.arc(tsx, tsy, 6, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${sc},0.7)`; gctx.fill();
    } else if (slot === 'R') {
      gctx.beginPath(); gctx.arc(tsx, tsy, 80, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${sc},0.1)`; gctx.fill();
      gctx.strokeStyle = `rgba(${sc},0.6)`; gctx.lineWidth = 1.5; gctx.stroke();
      gctx.beginPath(); gctx.arc(tsx, tsy, 6, 0, Math.PI * 2);
      gctx.fillStyle = `rgba(${sc},0.7)`; gctx.fill();
    }
  } else if (p.charId === 'surge') {
    if (slot === 'Q') {
      gctx.beginPath(); gctx.moveTo(ps.x, ps.y); gctx.lineTo(tsx, tsy);
      gctx.strokeStyle = 'rgba(0,212,255,0.4)'; gctx.lineWidth = 2; gctx.stroke();
      gctx.beginPath(); gctx.arc(tsx, tsy, 8, 0, Math.PI * 2);
      gctx.fillStyle = 'rgba(0,212,255,0.5)'; gctx.shadowColor = '#00d4ff'; gctx.shadowBlur = 10; gctx.fill();
    } else if (slot === 'E') {
      gctx.beginPath(); gctx.arc(ps.x, ps.y, p.size + 14, 0, Math.PI * 2);
      gctx.strokeStyle = 'rgba(0,212,255,0.7)'; gctx.lineWidth = 2.5;
      gctx.setLineDash([5, 3]); gctx.stroke(); gctx.setLineDash([]);
    } else if (slot === 'R') {
      gctx.beginPath(); gctx.arc(ps.x, ps.y, 40, 0, Math.PI * 2);
      gctx.strokeStyle = 'rgba(0,212,255,0.6)'; gctx.lineWidth = 2; gctx.stroke();
      gctx.beginPath(); gctx.arc(ps.x, ps.y, 28, 0, Math.PI * 2);
      gctx.fillStyle = 'rgba(0,212,255,0.08)'; gctx.fill();
    }
  }

  // Ability name label
  gctx.shadowBlur = 0;
  gctx.font = 'bold 11px "Share Tech Mono",monospace';
  gctx.textAlign = 'center';
  gctx.fillStyle = p.color;
  gctx.fillText(`[${slot}] ${ab.name} — LMB to use  RMB/ESC to cancel`, W / 2, H - 110);

  gctx.restore();
}

function drawPlayer(p) {
  const x = p.x, y = p.y, r = p.size, angle = p.aimAngle || 0;
  if (p.effects.phasing > 0 && Math.floor(gs.tick / 5) % 2 === 0) return;
  gctx.save();
  // Team ring
  gctx.beginPath(); gctx.arc(x, y, r + 9, 0, Math.PI * 2);
  gctx.strokeStyle = p.team === 'A' ? '#e63946' : '#00d4ff'; gctx.lineWidth = 1; gctx.globalAlpha = 0.25;
  gctx.shadowColor = gctx.strokeStyle; gctx.shadowBlur = 18; gctx.stroke(); gctx.globalAlpha = 1;
  // Body
  gctx.beginPath(); gctx.arc(x, y, r, 0, Math.PI * 2);
  gctx.fillStyle = p.color + '22'; gctx.fill();
  gctx.strokeStyle = p.color; gctx.lineWidth = 2.5; gctx.shadowColor = p.color; gctx.shadowBlur = 14; gctx.stroke(); gctx.shadowBlur = 0;
  // Shield ring
  if (p.shield) {
    gctx.beginPath(); gctx.arc(x, y, r + 11, 0, Math.PI * 2);
    gctx.strokeStyle = '#00d4ff'; gctx.lineWidth = 2.5; gctx.setLineDash([5, 3]);
    gctx.shadowColor = '#00d4ff'; gctx.shadowBlur = 12; gctx.stroke(); gctx.setLineDash([]); gctx.shadowBlur = 0;
  }
  // Boost pulse
  if (p.boosted) {
    gctx.beginPath(); gctx.arc(x, y, r + 16 + Math.sin((gs.tick || 0) * 0.2) * 3, 0, Math.PI * 2);
    gctx.strokeStyle = '#00d4ff44'; gctx.lineWidth = 1; gctx.stroke();
  }
  // Emoji + gun barrel (rotated to aim angle)
  gctx.save(); gctx.translate(x, y); gctx.rotate(angle);
  gctx.font = `${r + 2}px serif`; gctx.textAlign = 'center'; gctx.textBaseline = 'middle';
  gctx.shadowBlur = 0; gctx.fillStyle = '#fff'; gctx.fillText(p.emoji, 0, 0);
  gctx.strokeStyle = p.color; gctx.lineWidth = 3; gctx.shadowColor = p.color; gctx.shadowBlur = 8;
  gctx.beginPath(); gctx.moveTo(r - 2, 0); gctx.lineTo(r + 10, 0); gctx.stroke(); gctx.shadowBlur = 0;
  gctx.fillStyle = p.color; gctx.beginPath(); gctx.arc(r + 10, 0, 2.5, 0, Math.PI * 2); gctx.fill();
  gctx.restore();
  // Aim line for local player
  if (p.pid === myId) {
    gctx.save(); gctx.strokeStyle = p.color + '66'; gctx.lineWidth = 1; gctx.setLineDash([4, 6]);
    gctx.beginPath();
    gctx.moveTo(x + Math.cos(angle) * (r + 12), y + Math.sin(angle) * (r + 12));
    gctx.lineTo(x + Math.cos(angle) * (r + 50), y + Math.sin(angle) * (r + 50));
    gctx.stroke(); gctx.setLineDash([]); gctx.restore();
  }
  // YOU label
  if (p.pid === myId) {
    gctx.font = 'bold 8px "Share Tech Mono",monospace'; gctx.textAlign = 'center';
    gctx.fillStyle = '#ffd700'; gctx.shadowColor = '#ffd700'; gctx.shadowBlur = 6;
    gctx.fillText('YOU', x, y - r - 17); gctx.shadowBlur = 0;
  }
  // Name
  gctx.font = 'bold 8px "Share Tech Mono",monospace'; gctx.textAlign = 'center';
  gctx.fillStyle = p.color; gctx.shadowColor = p.color; gctx.shadowBlur = 5;
  gctx.fillText(p.name, x, y - r - 7); gctx.shadowBlur = 0;
  // HP bar
  const bw = 44, bh = 3;
  gctx.fillStyle = '#0a0a0a'; gctx.fillRect(x - bw / 2, y - r - 20, bw, bh);
  const pct = p.hp / p.maxHp;
  gctx.fillStyle = pct > .5 ? p.color : pct > .25 ? '#ffd700' : '#ff0000';
  gctx.shadowColor = gctx.fillStyle; gctx.shadowBlur = 5;
  gctx.fillRect(x - bw / 2, y - r - 20, bw * pct, bh); gctx.shadowBlur = 0;
  gctx.restore();
}

// ── Fog of war — raycasting wall shadows only ────
const FOG_R = 3000;
const CONE_ANGLE = Math.PI * (120 / 180); // kept for ability preview reference only

function drawFog(W, H) {
  const me = gs && gs.players[myId];
  if (!me || !me.alive) return;

  const px = me.x, py = me.y;
  const far = gs.W + gs.H;

  gctx.save();
  gctx.fillStyle = '#000';

  const SW = gc.width, SH = gc.height;

  // ── Wall shadows ──
  for (let wi = 4; wi < gs.walls.length; wi++) {
    const w = gs.walls[wi];
    const wx1 = w.x, wy1 = w.y, wx2 = w.x + w.w, wy2 = w.y + w.h;
    if (px >= wx1 && px <= wx2 && py >= wy1 && py <= wy2) continue;
    if (wx2 - camX < -SW || wx1 - camX > SW * 2 || wy2 - camY < -SH || wy1 - camY > SH * 2) continue;

    const corners = [[wx1, wy1], [wx2, wy1], [wx2, wy2], [wx1, wy2]];
    const angs = corners.map(([cx, cy]) => Math.atan2(cy - py, cx - px));
    let lo = angs[0], hi = angs[0], loI = 0, hiI = 0;
    for (let i = 1; i < 4; i++) {
      if (angs[i] < lo) { lo = angs[i]; loI = i; }
      if (angs[i] > hi) { hi = angs[i]; hiI = i; }
    }
    if (hi - lo > Math.PI) {
      const sh = angs.map(a => a < 0 ? a + Math.PI * 2 : a);
      lo = sh[0]; hi = sh[0]; loI = 0; hiI = 0;
      for (let i = 1; i < 4; i++) {
        if (sh[i] < lo) { lo = sh[i]; loI = i; }
        if (sh[i] > hi) { hi = sh[i]; hiI = i; }
      }
    }
    if (hi - lo > Math.PI * 1.5) continue;
    const [lx, ly] = corners[loI], [rx, ry] = corners[hiI];
    const la = Math.atan2(ly - py, lx - px), ra = Math.atan2(ry - py, rx - px);
    gctx.beginPath();
    gctx.moveTo(lx, ly);
    gctx.lineTo(lx + Math.cos(la) * far, ly + Math.sin(la) * far);
    gctx.lineTo(rx + Math.cos(ra) * far, ry + Math.sin(ra) * far);
    gctx.lineTo(rx, ry);
    gctx.closePath();
    gctx.fill();
  }

  // ── Smoke shadows — rectangle starts at back outer edge ──
  gs.zones.filter(z => z.shadowR).forEach(z => {
    if (d(px, py, z.x, z.y) < z.r) return;
    const SW = gc.width, SH = gc.height;
    if (z.x + z.r - camX < -SW || z.x - z.r - camX > SW * 2) return;
    if (z.y + z.r - camY < -SH || z.y - z.r - camY > SH * 2) return;

    const ang = Math.atan2(z.y - py, z.x - px);
    const perp = ang + Math.PI / 2;

    // Shadow rect starts at back edge of circle
    const bx = z.x + Math.cos(ang) * z.r;
    const by = z.y + Math.sin(ang) * z.r;

    // Width = diameter of smoke
    const tlx = bx + Math.cos(perp) * z.r, tly = by + Math.sin(perp) * z.r;
    const trx = bx - Math.cos(perp) * z.r, try_ = by - Math.sin(perp) * z.r;

    const sdx = Math.cos(ang) * far, sdy = Math.sin(ang) * far;

    gctx.beginPath();
    gctx.moveTo(tlx, tly);
    gctx.lineTo(tlx + sdx, tly + sdy);
    gctx.lineTo(trx + sdx, try_ + sdy);
    gctx.lineTo(trx, try_);
    gctx.closePath();
    gctx.fill();
  });

  gctx.restore();
}

function isVisible(tx, ty) {
  const me = gs && gs.players[myId];
  if (!me) return false;
  const dx = tx - me.x, dy = ty - me.y, steps = Math.ceil(Math.hypot(dx, dy) / 8);
  for (let i = 1; i < steps; i++) {
    const sx = me.x + dx * i / steps, sy = me.y + dy * i / steps;
    for (let wi = 4; wi < gs.walls.length; wi++) {
      const w = gs.walls[wi];
      if (sx > w.x && sx < w.x + w.w && sy > w.y && sy < w.y + w.h) return false;
    }
  }
  return true;
}

function drawMinimap(W, H) {
  const mw = 150, mh = 112;
  const sx = mw / gs.W, sy = mh / gs.H; // scale by MAP size
  mmX.fillStyle = '#01010a'; mmX.fillRect(0, 0, mw, mh);
  mmX.fillStyle = 'rgba(0,0,0,0.5)'; mmX.fillRect(0, 0, mw, mh);
  mmX.fillStyle = '#1e2230';
  gs.walls.slice(4).forEach(w => mmX.fillRect(w.x * sx, w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy)));
  // Draw viewport indicator
  const SW = gc.width, SH = gc.height;
  mmX.strokeStyle = 'rgba(255,255,255,0.2)'; mmX.lineWidth = 1;
  mmX.strokeRect(camX * sx, camY * sy, SW * sx, SH * sy);
  // Draw players
  Object.values(gs.players).forEach(p => {
    const isAlly = p.team === myTeam;
    const visible = isAlly || isVisible(p.x, p.y);
    if (!visible && !isAlly) return;
    mmX.save(); mmX.globalAlpha = p.alive ? (isAlly ? 1 : 0.6) : 0.15;
    mmX.fillStyle = p.pid === myId ? '#ffd700' : p.color;
    mmX.beginPath(); mmX.arc(p.x * sx, p.y * sy, p.alive ? 3.5 : 2, 0, Math.PI * 2); mmX.fill(); mmX.restore();
  });
  mmX.strokeStyle = '#1e2230'; mmX.lineWidth = 1; mmX.strokeRect(0, 0, mw, mh);
}

// ── Round over & navigation ───────────────────────
function showROver(winner, sc, rn) {
  score = [...sc]; roundN = rn;
  const ro = document.getElementById('rover'), wt = document.getElementById('rowt');
  if (winner === 'DRAW') { wt.textContent = 'DRAW'; wt.style.color = '#ffd700'; ro.style.borderColor = '#ffd700'; }
  else { const col = winner === 'A' ? '#e63946' : '#00d4ff'; wt.textContent = `TEAM ${winner} WINS`; wt.style.color = col; ro.style.borderColor = col; }
  document.getElementById('rows_').textContent = `ROUND ${rn}  ·  A:${sc[0]}  B:${sc[1]}`;
  const mo = sc[0] >= 3 || sc[1] >= 3 || rn >= MAX_ROUNDS;
  const rob = document.getElementById('rob_');
  if (mo) {
    const mv = sc[0] > sc[1] ? 'A' : sc[1] > sc[0] ? 'B' : null;
    document.getElementById('rows_').textContent = mv ? `MATCH OVER — TEAM ${mv} IS CHAMPION` : 'MATCH DRAW';
    rob.textContent = 'BACK TO LOBBY'; rob.onclick = backToLobby;
  } else {
    rob.textContent = isHost ? 'NEXT ROUND' : 'WAITING FOR HOST...';
    rob.style.opacity = isHost ? '1' : '0.4'; rob.style.cursor = isHost ? 'pointer' : 'default';
    rob.onclick = isHost ? hostNR : null;
  }
  ro.style.display = 'block';
}

function hostNR() {
  roundN++;
  if (testerMode) {
    const W = window.innerWidth, H = window.innerHeight - 100, p2id = 'tester_p2', players = {};
    players[myId] = mkP(myId, 'P1', W * 0.15, H / 2, CHARS[0], 'A', true);
    players[p2id] = mkP(p2id, 'P2', W * 0.85, H / 2, CHARS[2], 'B', false);
    const prev = [...gs.score];
    gs = { players, walls: mkWalls(W, H), projs: [], parts: [], zones: [], decoys: [], W, H, tick: 0, ended: false, score: prev, round: roundN };
    fixRefs(); gamePaused = false;
    document.getElementById('rover').style.display = 'none';
    document.getElementById('kf').innerHTML = ''; document.getElementById('elog').innerHTML = '';
    buildHUD(); return;
  }
  const ns = buildState(); ns.score = [...gs.score]; ns.round = roundN;
  send({ type: 'NR', st: ns, rn: roundN });
  gs = clone(ns); fixRefs(); gamePaused = false;
  document.getElementById('rover').style.display = 'none';
  document.getElementById('kf').innerHTML = ''; document.getElementById('elog').innerHTML = '';
  buildHUD();
}

function backToLobby() {
  testerMode = false; gamePaused = false;
  gs = null; if (raf) { cancelAnimationFrame(raf); raf = null; }
  gc.style.display = fogC.style.display = mmC.style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  document.getElementById('ntag').style.display = 'none';
  document.getElementById('rover').style.display = 'none';
  document.getElementById('pauseMenu').classList.remove('on');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  score = [0, 0]; roundN = 1; showScreen('sLobby');
}

// ── Pause menu ───────────────────────────────────


function togglePause() { gamePaused ? resumeGame() : pauseGame(); }

function pauseGame() {
  gamePaused = true; keys = {};
  document.getElementById('pauseMenu').classList.add('on');
  if (gs) {
    const sc = gs.score || score;
    document.getElementById('pauseRound').textContent = `ROUND ${roundN} · A:${sc[0]}  B:${sc[1]}`;
  }
}
function resumeGame() {
  gamePaused = false;
  document.getElementById('pauseMenu').classList.remove('on');
  const sKeys = document.getElementById('sKeys');
  if (sKeys.classList.contains('on')) sKeys.classList.remove('on');
}
function pauseGoKeys() {
  document.getElementById('pauseMenu').classList.remove('on');
  showScreen('sKeys'); renderKeyGrid();
  const kb = document.getElementById('kbGrid');
  const old = document.getElementById('kbBackRow'); if (old) old.remove();
  const backRow = document.createElement('div');
  backRow.id = 'kbBackRow'; backRow.style.cssText = 'grid-column:1/-1;display:flex;justify-content:center;gap:10px;margin-top:10px';
  backRow.innerHTML = `<button class="kb-save" onclick="backToPause()">BACK TO GAME</button>`;
  kb.parentElement.insertBefore(backRow, document.querySelector('.kb-save'));
}
function backToPause() { saveKeys(); pauseGame(); }
function pauseQuit() { backToLobby(); document.getElementById('pauseMenu').classList.remove('on'); gamePaused = false; }
