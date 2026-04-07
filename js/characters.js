// =====================================================
// characters.js — Character data
// Owner: Person 2 (Game Engine)
// =====================================================
'use strict';

const CHARS = [
  {
    id:'ghost', name:'GHOST', role:'DUELIST', emoji:'👻', color:'#e63946',
    desc:'Spectral assassin. Phases through walls, drops decoys.',
    hp:90, speed:3.8, ammo:40, reloadF:120,
    abilities:[
      {key:'Q', name:'Shadow Dash', emoji:'🌑', desc:'Phase-dash forward',        cd:8,  fn:'abilShadowDash'},
      {key:'E', name:'Phantasm',    emoji:'👁',  desc:'Drop a decoy clone',        cd:10, fn:'abilPhantasm'},
      {key:'R', name:'Soul Drain',  emoji:'💀', desc:'Drain HP from nearest enemy',cd:15, fn:'abilSoulDrain'},
    ]
  },
  {
    id:'nova', name:'NOVA', role:'CONTROLLER', emoji:'🌀', color:'#7b00ff',
    desc:'Gravity manipulator. Pulls enemies, warps controls.',
    hp:115, speed:2.9, ammo:40, reloadF:120,
    abilities:[
      {key:'Q', name:'Grav Pull',  emoji:'🔮', desc:'Yank nearest enemy toward you',     cd:7,  fn:'abilGravPull'},
      {key:'E', name:'Warp Field', emoji:'🌀', desc:'Zone reversing controls',             cd:9,  fn:'abilWarpField'},
      {key:'R', name:'Black Hole', emoji:'⚫', desc:'Gravity vortex sucks enemies in',    cd:16, fn:'abilBlackHole'},
    ]
  },
  {
    id:'surge', name:'SURGE', role:'VANGUARD', emoji:'⚡', color:'#00d4ff',
    desc:'Electro-warrior. Lightning bolt, shield, overcharge.',
    hp:125, speed:3.0, ammo:40, reloadF:120,
    abilities:[
      {key:'Q', name:'Chain Bolt',   emoji:'⚡', desc:'Bouncing lightning projectile', cd:6,  fn:'abilChainBolt'},
      {key:'E', name:'Tesla Shield', emoji:'🛡', desc:'Block next projectile',          cd:10, fn:'abilTeslaShield'},
      {key:'R', name:'Overcharge',   emoji:'🌩', desc:'Speed + rapid-fire 5s',          cd:18, fn:'abilOvercharge'},
    ]
  },
];
