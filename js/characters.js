// =====================================================
// characters.js — Character data
// Owner: Person 2 (Game Engine)
// =====================================================
'use strict';

const CHARS = [
  {
    id:'reyna', name:'REYNA', role:'DUELIST', emoji:'👁', color:'#9b45d6',
    // Valorant Reyna — deep violet purple
    desc:'Aggressive duelist. Blinds enemies, smokes cover, heals on kills.',
    hp:100, speed:3.6, ammo:40, reloadF:120,
    abilities:[
      {key:'Q', name:'Flash',  emoji:'🔆', desc:'Blind all enemies in cone',     cd:10, fn:'abilFlash'},
      {key:'E', name:'Smoke',  emoji:'💨', desc:'Deploy smoke cloud at cursor',  cd:12, fn:'abilSmoke'},
      {key:'R', name:'Devour', emoji:'💉', desc:'Heal HP instantly',             cd:14, fn:'abilDevour'},
    ]
  },
  {
    id:'sage', name:'SAGE', role:'SENTINEL', emoji:'🌿', color:'#4fc3a1',
    // Valorant Sage — teal/seafoam green
    desc:'Support sentinel. Heals allies, builds walls, slows enemies.',
    hp:120, speed:2.8, ammo:40, reloadF:120,
    abilities:[
      {key:'Q', name:'Heal',       emoji:'💚', desc:'Restore HP to yourself',           cd:12, fn:'abilHeal'},
      {key:'E', name:'Barrier',    emoji:'🧱', desc:'Erect a solid wall at cursor',     cd:16, fn:'abilBarrier'},
      {key:'R', name:'Slow Field', emoji:'❄️',  desc:'Deploy a slowing zone at cursor',  cd:14, fn:'abilSlowField'},
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
