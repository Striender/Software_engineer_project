// =====================================================
// engine.js — Game Physics, Abilities, Input, State
// Owner: Person 2 (Game Engine)
// =====================================================
'use strict';

// ── Shared game state ────────────────────────────
let gs   = null;
let raf  = null;
let keys = {};
let score  = [0, 0];
let roundN = 1;
const MAX_ROUNDS = 7;
let gamePaused = false;

// ── Canvas resize (defined here so engine can call it) ────
function rsz(W,H){
  // W,H here is MAP size — canvases should be SCREEN size
  const SW = gs && gs.SW ? gs.SW : window.innerWidth;
  const SH = gs && gs.SH ? gs.SH : window.innerHeight-100;
  const gc=document.getElementById('gc');
  const fogC=document.getElementById('fogC');
  const mmC=document.getElementById('mmC');
  if(gc)  { gc.width=SW;   gc.height=SH;   }
  if(fogC){ fogC.width=SW; fogC.height=SH; }
  if(mmC) { mmC.width=150; mmC.height=112; }
}

// ── Keybindings ──────────────────────────────────
const DEFAULT_KEYS = { up:'w', down:'s', left:'a', right:'d', fire:' ', ab1:'q', ab2:'e', ab3:'r' };
let KB = {...DEFAULT_KEYS};
let listeningFor  = null;
let listeningReady= false;

function loadKeys(){
  const saved = localStorage.getItem('nd_keys');
  if(saved) try{ KB = {...DEFAULT_KEYS, ...JSON.parse(saved)}; }catch(e){}
}
function saveKeys(){
  localStorage.setItem('nd_keys', JSON.stringify(KB));
  showScreen('sMenu');
}
loadKeys();

const KB2 = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', fire:'Enter', ab1:'u', ab2:'i', ab3:'o' };

// ── Input mapping ────────────────────────────────
function buildServerKeys(){
  const out = buildServerKeysFor(KB);
  const me  = gs && gs.players[myId];
  if(me){
    const mw = mouseWorld(); // mouse in world coords
    const dx = mw.x - me.x, dy = mw.y - me.y;
    out._aim     = Math.atan2(dy, dx);
    out._aimDist = Math.hypot(dx, dy);
  }
  // Block fire while ability is equipped
  if(equippedAbility){ delete out[' ']; }
  return out;
}

function buildServerKeysFor(kb){
  const out = {};
  function isDown(k){ return !!(keys[k] || (k && k.length===1 && keys[k.toLowerCase()])); }
  if(isDown(kb.up))    out['w'] = true;
  if(isDown(kb.down))  out['s'] = true;
  if(isDown(kb.left))  out['a'] = true;
  if(isDown(kb.right)) out['d'] = true;
  if(isDown(kb.fire))  out[' '] = true;
  // Tester P2: aim derived from movement direction
  if(kb===KB2){
    let ax=0,ay=0;
    if(out['w'])ay=-1; if(out['s'])ay=1;
    if(out['a'])ax=-1; if(out['d'])ax=1;
    const p2 = gs && gs.players['tester_p2'];
    out._aim = (ax!==0||ay!==0) ? Math.atan2(ay,ax) : (p2?p2.aimAngle:0);
  }
  return out;
}

// ── Game state builders ──────────────────────────
const MAP_SCALE = 2; // map is 4x the screen size

function buildState(){
  const SW=window.innerWidth, SH=window.innerHeight-100;
  const W=SW*MAP_SCALE, H=SH*MAP_SCALE;
  const tA = Object.entries(lobby).filter(([,p])=>p.team==='A');
  const tB = Object.entries(lobby).filter(([,p])=>p.team==='B');
  const players = {};
  const is1v1 = matchMode===1;
  const spA = is1v1?[{x:W*0.87,y:H*0.22}]:[{x:W*0.87,y:H*0.18},{x:W*0.87,y:H*0.28}];
  const spB = is1v1?[{x:W*0.87,y:H*0.78}]:[{x:W*0.87,y:H*0.72},{x:W*0.87,y:H*0.82}];
  tA.slice(0,is1v1?1:2).forEach(([pid,p],i)=>{ players[pid]=mkP(pid,p.name,spA[i].x,spA[i].y,CHARS[p.charIdx],'A',true); });
  tB.slice(0,is1v1?1:2).forEach(([pid,p],i)=>{ players[pid]=mkP(pid,p.name,spB[i].x,spB[i].y,CHARS[p.charIdx],'B',false); });
  return {players,walls:mkWalls(W,H),projs:[],parts:[],zones:[],decoys:[],W,H,SW,SH,tick:0,ended:false,score:[0,0],round:1};
}

function mkP(pid,name,x,y,ch,team,facR){
  return {
    pid,name,x,y,team,facR,charId:ch.id,color:ch.color,emoji:ch.emoji,
    hp:ch.hp,maxHp:ch.hp,speed:ch.speed,size:18,
    ammo:ch.ammo,maxAmmo:ch.ammo,reloadF:ch.reloadF,reloadMax:ch.reloadF,reloading:0,
    shootCd:0,alive:true,shield:false,boosted:false,boostTimer:0,
    aimAngle:facR?0:Math.PI,
    cooldowns:{Q:0,E:0,R:0},
    effects:{phasing:0,frozen:0,warped:0,slow:0},
    abilities:ch.abilities,_k:{}
  };
}

function mkWalls(W,H){
  const walls = [];
  // Border walls (first 4 — never cast shadows)
  walls.push(
    {x:0,      y:0,      w:W,   h:12  }, // top
    {x:0,      y:H-12,   w:W,   h:12  }, // bottom
    {x:0,      y:0,      w:12,  h:H   }, // left
    {x:W-12,   y:0,      w:12,  h:H   }  // right
  );

  // ── Helper: push a wall rect ──
  const r=(x,y,w,h)=>walls.push({x,y,w,h});

  // Map is W×H. Ascent-inspired layout divided into zones:
  //   A Site: top-left quarter
  //   Mid/Piazza: center
  //   B Site: bottom-left quarter
  //   A Main: left corridor connecting spawn-A to A site
  //   B Main: right corridor connecting spawn-B to B site
  //   Catwalk: top diagonal from A site to mid
  //   Market: covered passage from mid to B site
  //   Spawn A: top-right
  //   Spawn B: bottom-right

  const u = W/100; // 1 unit = 1% of width
  const v = H/100; // 1 unit = 1% of height

  // ── A SITE walls (top-left ~25% of map) ──
  // Main box (top-left of site)
  r(2*u, 8*v, 18*u, 3*v);   // top wall of site
  r(2*u, 8*v, 3*v, 16*v);   // left wall of site (vertical)
  r(2*u, 24*v, 20*u, 3*v);  // bottom wall of site

  // A site big box
  r(6*u, 11*v, 10*u, 10*v);

  // A site cubby (right side of site)
  r(18*u, 11*v, 6*u, 5*v);
  r(18*u, 19*v, 6*u, 5*v);

  // A site back wall connector
  r(24*u, 8*v, 3*v, 16*v);

  // ── A MAIN (left corridor top, connecting spawn to A site) ──
  r(2*u, 30*v, 22*u, 3*v);  // top wall of A main
  r(2*u, 42*v, 22*u, 3*v);  // bottom wall of A main
  // pillar in A main
  r(10*u, 33*v, 5*u, 6*v);

  // ── CATWALK (A site → Mid, diagonal top) ──
  r(27*u, 8*v, 3*v, 20*v);   // left wall of catwalk
  r(38*u, 8*v, 3*v, 15*v);   // right wall of catwalk
  r(27*u, 8*v, 14*u, 3*v);   // top wall
  // catwalk box cover
  r(29*u, 16*v, 7*u, 7*v);

  // ── A LINK / HEAVEN (top corridor from catwalk to mid) ──
  r(41*u, 8*v, 3*v, 20*v);   // left wall
  r(54*u, 8*v, 3*v, 20*v);   // right wall
  r(41*u, 8*v, 16*u, 3*v);   // top wall
  // Heaven box
  r(44*u, 12*v, 7*u, 8*v);

  // ── TREE AREA (top-mid) ──
  r(57*u, 8*v, 18*u, 3*v);   // top wall
  r(57*u, 8*v, 3*v, 15*v);   // left wall
  r(72*u, 8*v, 3*v, 15*v);   // right wall
  // Tree object
  r(62*u, 12*v, 6*u, 8*v);

  // ── MID / PIAZZA (center of map) ──
  // Mid is an open area with iconic mid doors and boxes
  r(27*u, 42*v, 3*v, 20*v);  // left wall of mid
  r(57*u, 42*v, 3*v, 20*v);  // right wall of mid
  r(27*u, 62*v, 30*u, 3*v);  // bottom wall of mid (partial)

  // Mid door left (small wall segment with gap = door)
  r(30*u, 42*v, 6*u, 3*v);   // wall left of door
  r(42*u, 42*v, 6*u, 3*v);   // wall right of door
  // (gap from 36u to 42u = mid door opening)

  // Mid boxes (cover objects)
  r(32*u, 47*v, 7*u, 5*v);   // left mid box
  r(48*u, 47*v, 7*u, 5*v);   // right mid box
  r(39*u, 54*v, 9*u, 4*v);   // center mid box

  // ── MARKET (covered passage mid → B, bottom-left of mid) ──
  r(27*u, 65*v, 3*v, 14*v);  // left wall
  r(42*u, 65*v, 3*v, 14*v);  // right wall
  r(27*u, 65*v, 18*u, 3*v);  // top wall
  r(27*u, 79*v, 18*u, 3*v);  // bottom wall
  // Market box
  r(31*u, 68*v, 7*u, 8*v);

  // ── B MAIN (right corridor bottom, connecting spawn-B to B site) ──
  r(57*u, 65*v, 3*v, 20*v);  // left wall
  r(72*u, 65*v, 3*v, 20*v);  // right wall
  r(57*u, 85*v, 15*u, 3*v);  // bottom wall connector
  // B main pillar
  r(62*u, 69*v, 5*u, 6*v);

  // ── B SITE (bottom-left ~25% of map) ──
  r(2*u, 70*v, 3*v, 22*v);   // left wall
  r(2*u, 70*v, 24*u, 3*v);   // top wall
  r(2*u, 92*v, 27*u, 3*v);   // bottom wall
  r(26*u, 70*v, 3*v, 22*v);  // right wall

  // B site main box (the large cover object)
  r(6*u, 74*v, 12*u, 12*v);

  // B site corner stack
  r(20*u, 74*v, 4*u, 6*v);
  r(20*u, 84*v, 4*u, 6*v);

  // ── SPAWN DIVIDERS ──
  // A side spawn corridor walls
  r(75*u, 8*v, 3*v, 30*v);   // inner left wall of spawn A
  r(75*u, 8*v, 22*u, 3*v);   // top spawn wall
  r(75*u, 38*v, 22*u, 3*v);  // bottom spawn A wall

  // B side spawn corridor walls
  r(75*u, 62*v, 3*v, 30*v);  // inner wall of spawn B
  r(75*u, 62*v, 22*u, 3*v);  // top spawn B wall
  r(75*u, 92*v, 22*u, 3*v);  // bottom spawn wall

  return walls;
}

function fixRefs(){
  Object.values(gs.players).forEach(p=>{
    const ch = CHARS.find(c=>c.id===p.charId) || CHARS[0];
    p.speed     = p.speed    || ch.speed;
    p.reloadF   = p.reloadF  || ch.reloadF;
    p.reloadMax = p.reloadMax|| ch.reloadF;
    p.abilities = ch.abilities;
    if(!p._k)       p._k={};
    if(p.aimAngle===undefined) p.aimAngle = p.facR?0:Math.PI;
    if(!p.effects)  p.effects={phasing:0,frozen:0,warped:0,slow:0};
    if(!p.cooldowns)p.cooldowns={Q:0,E:0,R:0};
  });
}

function startHost(st){
  gamePaused=false; equippedAbility=null; gs=clone(st); if(!gs.parts)gs.parts=[];
  fixRefs(); rsz(gs.W,gs.H); showGame(); setupNtag(); buildHUD();
  if(raf)cancelAnimationFrame(raf); raf=requestAnimationFrame(hostTick);
}
function startClient(st){
  gamePaused=false; equippedAbility=null; gs=clone(st); if(!gs.parts)gs.parts=[];
  fixRefs(); rsz(gs.W,gs.H); showGame(); setupNtag(); buildHUD();
  if(raf)cancelAnimationFrame(raf); raf=requestAnimationFrame(clientTick);
}

// ── Host physics update ──────────────────────────
function hostUpdate(){
  gs.tick++;
  const ps = Object.values(gs.players);
  ps.forEach(p=>{ if(p.alive){ doMove(p); doShoot(p); doTick(p); } });

  gs.projs = gs.projs.filter(pr=>{
    if(!pr.trail) pr.trail=[];
    pr.trail.push({x:pr.x,y:pr.y,l:8,ml:8});
    pr.x+=pr.vx; pr.y+=pr.vy; pr.life--;

    // Flash orb — explodes when life hits 0 or hits a wall
    if(pr.flash){
      if(pr.life<=0 || wHit(pr.x,pr.y,pr.size)){
        // Explode — blind any enemy facing the flash
        burst(pr.x,pr.y,'#ffff99',30);
        Object.values(gs.players).filter(e=>e.alive&&e.team!==gs.players[pr.owner]?.team).forEach(e=>{
          // Check if enemy is LOOKING TOWARD the flash orb
          const toFlash = Math.atan2(pr.y-e.y, pr.x-e.x);
          let diff = toFlash - (e.aimAngle||0);
          while(diff >  Math.PI) diff -= Math.PI*2;
          while(diff < -Math.PI) diff += Math.PI*2;
          if(Math.abs(diff) < Math.PI*0.5){ // within 90° of aim = facing it
            e.effects.flashed = 12; // ~200ms at 60fps
            burst(e.x,e.y,'#ffff99',15);
          }
        });
        return false;
      }
      return true;
    }

    if(pr.life<=0) return false;
    if(wHit(pr.x,pr.y,pr.size)){
      if(pr.bounce>0){ pr.vx*=-1; pr.vy*=-1; pr.bounce--; }
      else{ burst(pr.x,pr.y,pr.color,5); return false; }
    }
    const ot = gs.players[pr.owner]?.team;
    for(const t of ps){
      if(!t.alive||t.team===ot||t.effects.phasing>0) continue;
      if(d(pr.x,pr.y,t.x,t.y)<pr.size+t.size){
        if(t.shield){ t.shield=false; burst(t.x,t.y,'#00d4ff',14); bfx('🛡 SHIELD ABSORBED!'); }
        else dmg(t,pr.dmg,pr.owner);
        burst(pr.x,pr.y,pr.color,7); return false;
      }
    }
    for(let i=gs.decoys.length-1;i>=0;i--){
      const dc=gs.decoys[i];
      if(dc.owner!==pr.owner && d(pr.x,pr.y,dc.x,dc.y)<dc.size+pr.size){
        burst(dc.x,dc.y,'#e63946',10); gs.decoys.splice(i,1); return false;
      }
    }
    return true;
  });

  gs.zones = gs.zones.filter(z=>{
    z.life--;
    const ot = gs.players[z.owner]?.team;
    ps.filter(p=>p.alive&&p.team!==ot).forEach(e=>{
      if(d(z.x,z.y,e.x,e.y)<z.r){
        if(z.dpf)  dmg(e,z.dpf,z.owner);
        if(z.slow) e.effects.slow=8;
        if(z.warp) e.effects.warped=8;
        if(z.pull){
          const a=Math.atan2(z.y-e.y,z.x-e.x);
          e.x=cl(e.x+Math.cos(a)*z.pull,30,gs.W-30);
          e.y=cl(e.y+Math.sin(a)*z.pull,20,gs.H-20);
        }
      }
    });
    return z.life>0;
  });

  gs.decoys = gs.decoys.filter(dc=>{ dc.life--; return dc.life>0; });
  gs.parts  = gs.parts.filter(p=>{ p.x+=p.vx; p.y+=p.vy; p.vx*=.92; p.vy*=.92; p.life--; return p.life>0; });
  gs.projs.forEach(pr=>{ if(pr.trail) pr.trail=pr.trail.filter(t=>{ t.l--; return t.l>0; }); });
  gs.walls  = gs.walls.filter(w=>{ if(!w.temp) return true; w.life--; return w.life>0; });

  const aA = ps.filter(p=>p.team==='A'&&p.alive).length;
  const bA = ps.filter(p=>p.team==='B'&&p.alive).length;
  if(!gs.ended && (aA===0||bA===0)){
    gs.ended = true;
    const w  = aA>0?'A':bA>0?'B':'DRAW';
    if(w!=='DRAW'){ const i=w==='A'?0:1; gs.score[i]++; score[i]=gs.score[i]; }
    setTimeout(()=>{ send({type:'REND',winner:w,score:gs.score,rn:roundN}); showROver(w,gs.score,roundN); }, 700);
  }
}

function doMove(p){
  if(p.effects.frozen>0) return;
  const k   = p._k||{};
  const w   = p.effects.warped>0;
  const slow= p.effects.slow>0?0.45:1;
  const spd = p.speed*slow;
  let mx=0,my=0;
  const up=w?'s':'w', dn=w?'w':'s', lf=w?'d':'a', rt=w?'a':'d';
  if(k[up]||k[up.toUpperCase()])  my-=spd;
  if(k[dn]||k[dn.toUpperCase()])  my+=spd;
  if(k[lf]||k[lf.toUpperCase()]) mx-=spd;
  if(k[rt]||k[rt.toUpperCase()]) mx+=spd;
  if(p.effects.warped>0) p.effects.warped--;
  if(p.effects.slow>0)   p.effects.slow--;
  const nx=p.x+mx; if(!wHit(nx,p.y,p.size-2)) p.x=nx;
  const ny=p.y+my; if(!wHit(p.x,ny,p.size-2)) p.y=ny;
  p.x=cl(p.x,30,gs.W-30); p.y=cl(p.y,20,gs.H-20);
  if(k._aim!==undefined) p.aimAngle=k._aim;
  p.facR = Math.cos(p.aimAngle||0) >= 0;
}

function doShoot(p){
  const k = p._k||{};
  if(!k[' ']&&!k['Enter']) return;
  // Block shooting while MY player has an ability equipped
  if(p.pid===myId && equippedAbility) return;
  if(p.reloading>0||p.shootCd>0) return;
  if(p.ammo<=0){ if(p.reloading<=0) p.reloading=p.reloadMax||120; return; }
  p.ammo--;
  p.shootCd = p.boosted?5:7;
  const angle  = p.aimAngle||0;
  const spd    = 13+(p.boosted?4:0);
  const spread = (Math.random()-0.5)*0.04;
  gs.projs.push({
    owner:p.pid,
    x:p.x+Math.cos(angle)*(p.size+3), y:p.y+Math.sin(angle)*(p.size+3),
    vx:Math.cos(angle+spread)*spd,     vy:Math.sin(angle+spread)*spd,
    size:4, dmg:8+(p.boosted?5:0), color:p.color, life:80, bounce:0, trail:[]
  });
  burst(p.x+Math.cos(angle)*p.size, p.y+Math.sin(angle)*p.size, p.color, 2);
  if(p.ammo===0) p.reloading=p.reloadMax||120;
}

function doTick(p){
  ['Q','E','R'].forEach(k=>{ if(p.cooldowns[k]>0) p.cooldowns[k]--; });
  if(p.shootCd>0)        p.shootCd--;
  if(p.effects.phasing>0)  p.effects.phasing--;
  if(p.effects.frozen>0)   p.effects.frozen--;
  if(p.effects.flashed>0)  p.effects.flashed--;
  if(p.reloading>0){ p.reloading--; if(p.reloading===0) p.ammo=p.maxAmmo; }
  if(p.boostTimer>0){
    p.boostTimer--;
    if(p.boostTimer===0){ p.boosted=false; const ch=CHARS.find(c=>c.id===p.charId); if(ch)p.speed=ch.speed; }
  }
}

function doAbility(p,slot){
  if(!p.alive||p.cooldowns[slot]>0) return;
  const ab = p.abilities?.find(a=>a.key===slot); if(!ab) return;
  p.cooldowns[slot] = ab.cd*60;
  window[ab.fn]?.(p);
  bfx(`${p.emoji} ${ab.name}!`);
}

// ── Abilities ────────────────────────────────────

// REYNA
function abilFlash(p){
  const a = p.aimAngle||0;
  const maxRange = 350;
  const dist = Math.min(p._k?._aimDist||200, maxRange);
  const travelFrames = 12; // always exactly 200ms at 60fps
  const spd = dist / travelFrames;
  gs.projs.push({
    owner: p.pid,
    x: p.x+Math.cos(a)*(p.size+4),
    y: p.y+Math.sin(a)*(p.size+4),
    vx: Math.cos(a)*spd,
    vy: Math.sin(a)*spd,
    size: 8, dmg: 0, color: '#9b45d6',
    life: travelFrames,
    bounce: 0, trail: [],
    flash: true
  });
  burst(p.x,p.y,'#9b45d6',8);
}
function abilSmoke(p){
  const maxRange=300;
  const dist=Math.min(p._k?._aimDist||150, maxRange);
  const a=p.aimAngle||0;
  const sx=p.x+Math.cos(a)*dist, sy=p.y+Math.sin(a)*dist;
  gs.zones.push({x:sx,y:sy,r:75,life:360,maxLife:360,color:'rgba(120,60,180,0.55)',border:'#9b45d6',owner:p.pid,smoke:true,shadowR:75});
  burst(sx,sy,'#9b45d6',18);
}
function abilDevour(p){
  p.hp=Math.min(p.maxHp,p.hp+45);
  burst(p.x,p.y,'#9b45d6',18); burst(p.x,p.y,'#c88aff',10);
}

// SAGE
function abilHeal(p){
  p.hp=Math.min(p.maxHp,p.hp+40);
  burst(p.x,p.y,'#4fc3a1',18);
  const allies=Object.values(gs.players).filter(a=>a.team===p.team&&a.alive&&a.pid!==p.pid);
  if(allies.length){
    const nr=allies.reduce((a,b)=>d(p.x,p.y,a.x,a.y)<d(p.x,p.y,b.x,b.y)?a:b);
    nr.hp=Math.min(nr.maxHp,nr.hp+40); burst(nr.x,nr.y,'#4fc3a1',12);
  }
}
function abilBarrier(p){
  const maxRange=250;
  const dist=Math.min(p._k?._aimDist||110, maxRange);
  const a=p.aimAngle||0;
  const wx=p.x+Math.cos(a)*dist, wy=p.y+Math.sin(a)*dist;
  const isH=Math.abs(Math.cos(a))<0.7;
  const bw=isH?90:12, bh=isH?12:90;
  // Wall is added to gs.walls so it auto-casts shadows via drawFog
  gs.walls.push({x:wx-bw/2,y:wy-bh/2,w:bw,h:bh,temp:true,life:480});
  gs.zones.push({x:wx,y:wy,r:50,life:480,maxLife:480,color:'rgba(0,255,136,0.12)',border:'#00ff88',owner:p.pid});
  burst(wx,wy,'#00ff88',22);
}
function abilSlowField(p){
  const a=p.aimAngle||0, dist=150;
  const sx=p.x+Math.cos(a)*dist, sy=p.y+Math.sin(a)*dist;
  gs.zones.push({x:sx,y:sy,r:80,life:360,maxLife:360,color:'rgba(0,180,255,0.18)',border:'#00d4ff',owner:p.pid,slow:true});
  burst(sx,sy,'#00d4ff',18);
}

// SURGE
function abilChainBolt(p){
  const a=p.aimAngle||0;
  gs.projs.push({owner:p.pid,x:p.x+Math.cos(a)*p.size,y:p.y+Math.sin(a)*p.size,vx:Math.cos(a)*10,vy:Math.sin(a)*10,size:6,dmg:20,color:'#00d4ff',life:130,bounce:3,trail:[]});
}
function abilTeslaShield(p){ p.shield=true; }
function abilOvercharge(p){ p.boosted=true; p.boostTimer=310; p.speed=(p.speed||3)*1.8; burst(p.x,p.y,'#00d4ff',25); }

// ── Damage ───────────────────────────────────────
function dmg(p,v,kpid){
  p.hp=Math.max(0,p.hp-v); burst(p.x,p.y,p.color,5);
  if(p.hp<=0&&p.alive){
    p.alive=false; burst(p.x,p.y,p.color,30);
    const k=gs.players[kpid];
    const txt=`${k?.emoji||'💀'} ${k?.name||'?'} eliminated ${p.emoji} ${p.name}`;
    addKF(txt,k?.color||'#fff');
    send({type:'KF',text:txt,color:k?.color||'#fff'});
  }
}

// ── Tester mode ──────────────────────────────────
let testerMode   = false;
let testerP1Char = 0;
let testerP2Char = 1;

function goTester(){
  testerMode = true;
  myTeam = 'A';
  myName = 'TESTER';
  try {
    showScreen('sSelect');
    const c = document.getElementById('scards');
    c.innerHTML = '';
    CHARS.forEach((ch, i)=>{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="cem">${ch.emoji}</div>
        <div class="cnm" style="color:${ch.color}">${ch.name}</div>
        <div class="crl">${ch.role}</div>
        <div class="cds">${ch.desc}</div>`;
      card.style.cursor='pointer';
      card.addEventListener('click', ()=>{
        testerP1Char = i;
        console.log('Card clicked, char:', ch.name, 'index:', i);
        try { startTester(); } catch(e){ alert('startTester error: '+e.message+'\n'+e.stack); }
      });
      c.appendChild(card);
    });
    document.getElementById('ssub').textContent = '🧪 TESTER — PICK YOUR AGENT';
    document.getElementById('swait').textContent = 'Click an agent to start';
    console.log('goTester done, cards:', c.children.length);
  } catch(e){ alert('goTester error: '+e.message+'\n'+e.stack); }
}

function startTester(){
  testerMode=true; myTeam='A'; myName='P1';
  gamePaused=false;
  if(raf){ cancelAnimationFrame(raf); raf=null; }

  const SW=window.innerWidth, SH=window.innerHeight-100;
  const W=SW*MAP_SCALE, H=SH*MAP_SCALE;
  const p2id='tester_p2', players={};
  players[myId] = mkP(myId, 'P1', W*0.87, H*0.22, CHARS[testerP1Char], 'A', true);
  players[p2id] = mkP(p2id, 'P2', W*0.87, H*0.78, CHARS[testerP2Char], 'B', false);
  const state={players,walls:mkWalls(W,H),projs:[],parts:[],zones:[],decoys:[],W,H,SW,SH,tick:0,ended:false,score:[0,0],round:1};
  isHost=true;
  lobby={
    [myId]:{name:'P1',team:'A',charIdx:testerP1Char},
    [p2id]:{name:'P2',team:'B',charIdx:testerP2Char}
  };
  gs=clone(state);
  fixRefs();
  rsz(gs.W, gs.H);
  showGame();
  setupNtag();
  buildHUD();
  raf=requestAnimationFrame(testerTick);
}

function testerTick(){
  const p1=gs.players[myId];
  const p2=gs.players['tester_p2'];
  if(p1) p1._k=buildServerKeys();
  if(p2) p2._k={};
  if(!gs.ended && !gamePaused) hostUpdate();
  drawFrame();
  raf=requestAnimationFrame(testerTick);
}

// ── Utilities ────────────────────────────────────
function wHit(x,y,r){ return gs.walls.some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h); }
function burst(x,y,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2,s=2+Math.random()*5; gs.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+Math.random()*30,maxLife:50,color,size:2+Math.random()*4}); } }
function d(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); }
function cl(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
