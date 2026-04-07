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
  if(me) out._aim = Math.atan2(mouseY - me.y, mouseX - me.x);
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
function buildState(){
  const W=window.innerWidth, H=window.innerHeight-100;
  const tA = Object.entries(lobby).filter(([,p])=>p.team==='A');
  const tB = Object.entries(lobby).filter(([,p])=>p.team==='B');
  const players = {};
  const is1v1 = matchMode===1;
  const spA = is1v1?[{x:W*0.15,y:H/2}]:[{x:W*0.12,y:H*0.35},{x:W*0.12,y:H*0.65}];
  const spB = is1v1?[{x:W*0.85,y:H/2}]:[{x:W*0.88,y:H*0.35},{x:W*0.88,y:H*0.65}];
  tA.slice(0,is1v1?1:2).forEach(([pid,p],i)=>{ players[pid]=mkP(pid,p.name,spA[i].x,spA[i].y,CHARS[p.charIdx],'A',true); });
  tB.slice(0,is1v1?1:2).forEach(([pid,p],i)=>{ players[pid]=mkP(pid,p.name,spB[i].x,spB[i].y,CHARS[p.charIdx],'B',false); });
  return {players,walls:mkWalls(W,H),projs:[],parts:[],zones:[],decoys:[],W,H,tick:0,ended:false,score:[0,0],round:1};
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
  return [
    {x:0,y:0,w:W,h:10},{x:0,y:H-10,w:W,h:10},
    {x:0,y:0,w:10,h:H},{x:W-10,y:0,w:10,h:H},
    {x:W/2-15,y:H*0.15,w:30,h:H*0.70},
    {x:W*0.28,y:H*0.10,w:22,h:H*0.32},{x:W*0.65,y:H*0.10,w:22,h:H*0.32},
    {x:W*0.28,y:H*0.58,w:22,h:H*0.32},{x:W*0.65,y:H*0.58,w:22,h:H*0.32},
    {x:W*0.08,y:H*0.42,w:100,h:16},{x:W*0.75,y:H*0.42,w:100,h:16},
    {x:W*0.38,y:H*0.12,w:90,h:14},{x:W*0.38,y:H*0.74,w:90,h:14},
  ];
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
  gamePaused=false; gs=clone(st); if(!gs.parts)gs.parts=[];
  fixRefs(); rsz(gs.W,gs.H); showGame(); setupNtag(); buildHUD();
  if(raf)cancelAnimationFrame(raf); raf=requestAnimationFrame(hostTick);
}
function startClient(st){
  gamePaused=false; gs=clone(st); if(!gs.parts)gs.parts=[];
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
  if(p.shootCd>0)       p.shootCd--;
  if(p.effects.phasing>0) p.effects.phasing--;
  if(p.effects.frozen>0)  p.effects.frozen--;
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
function abilShadowDash(p){
  burst(p.x,p.y,'#e63946',14); p.effects.phasing=55;
  const a=p.aimAngle||0, totalDist=140, steps=20, step=totalDist/steps;
  let tx=p.x,ty=p.y;
  for(let i=0;i<steps;i++){
    const nx=tx+Math.cos(a)*step, ny=ty+Math.sin(a)*step;
    if(wHit(cl(nx,30,gs.W-30),cl(ny,20,gs.H-20),p.size-2)) break;
    tx=cl(nx,30,gs.W-30); ty=cl(ny,20,gs.H-20);
  }
  p.x=tx; p.y=ty; burst(p.x,p.y,'#e63946',14);
}
function abilPhantasm(p){
  const a=p.aimAngle||0;
  gs.decoys.push({x:p.x+Math.cos(a)*70, y:p.y+Math.sin(a)*70, life:220, color:p.color, emoji:p.emoji, owner:p.pid, size:18});
}
function abilSoulDrain(p){
  const en=Object.values(gs.players).filter(e=>e.team!==p.team&&e.alive); if(!en.length)return;
  const nr=en.reduce((a,b)=>d(p.x,p.y,a.x,a.y)<d(p.x,p.y,b.x,b.y)?a:b);
  if(d(p.x,p.y,nr.x,nr.y)<160){ dmg(nr,22,p.pid); p.hp=Math.min(p.maxHp,p.hp+11); burst(nr.x,nr.y,'#e63946',14); }
}
function abilGravPull(p){
  const en=Object.values(gs.players).filter(e=>e.team!==p.team&&e.alive); if(!en.length)return;
  const nr=en.reduce((a,b)=>d(p.x,p.y,a.x,a.y)<d(p.x,p.y,b.x,b.y)?a:b);
  const a=Math.atan2(p.y-nr.y,p.x-nr.x);
  nr.x=cl(nr.x+Math.cos(a)*90,30,gs.W-30); nr.y=cl(nr.y+Math.sin(a)*90,20,gs.H-20);
  burst(nr.x,nr.y,'#7b00ff',16);
}
function abilWarpField(p){
  gs.zones.push({x:p.x,y:p.y,r:90,life:300,maxLife:300,color:'rgba(123,0,255,.1)',border:'#7b00ff',owner:p.pid,warp:true});
  burst(p.x,p.y,'#7b00ff',18);
}
function abilBlackHole(p){
  const a=p.aimAngle||0, bx=p.x+Math.cos(a)*120, by=p.y+Math.sin(a)*120;
  gs.zones.push({x:bx,y:by,r:130,life:180,maxLife:180,color:'rgba(40,0,80,.22)',border:'#7b00ff',owner:p.pid,pull:2.5});
  burst(bx,by,'#7b00ff',25);
}
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
const TESTER_PWD = 'Shivam';
let testerMode   = false;

function goTester(){
  showScreen('sTester');
  document.getElementById('tpwd').value='';
  document.getElementById('tpwderr').textContent='';
}

function startTester(){
  if(document.getElementById('tpwd').value !== TESTER_PWD){
    document.getElementById('tpwderr').textContent='✗ WRONG PASSWORD'; return;
  }
  testerMode=true; myTeam='A'; myName='P1';
  const W=window.innerWidth, H=window.innerHeight-100;
  const p2id='tester_p2', players={};
  players[myId]  = mkP(myId, 'P1', W*0.15, H/2, CHARS[0], 'A', true);
  players[p2id]  = mkP(p2id, 'P2', W*0.85, H/2, CHARS[2], 'B', false);
  const state={players,walls:mkWalls(W,H),projs:[],parts:[],zones:[],decoys:[],W,H,tick:0,ended:false,score:[0,0],round:1};
  isHost=true;
  lobby={[myId]:{name:'P1',team:'A',charIdx:0},[p2id]:{name:'P2',team:'B',charIdx:2}};
  showGame(); gs=clone(state); fixRefs(); rsz(gs.W,gs.H); setupNtag(); buildHUD();
  if(raf)cancelAnimationFrame(raf); raf=requestAnimationFrame(testerTick);
}

function testerTick(){
  const p1=gs.players[myId], p2=gs.players['tester_p2'];
  if(p1) p1._k=buildServerKeys();
  if(p2) p2._k=buildServerKeysFor(KB2);
  if(!gs.ended) hostUpdate();
  drawFrame();
  raf=requestAnimationFrame(testerTick);
}

// ── Utilities ────────────────────────────────────
function wHit(x,y,r){ return gs.walls.some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h); }
function burst(x,y,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2,s=2+Math.random()*5; gs.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+Math.random()*30,maxLife:50,color,size:2+Math.random()*4}); } }
function d(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); }
function cl(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
