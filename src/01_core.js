'use strict';
// =====================================================================
//  IRONVALE — a browser RTS. Everything (models, textures, audio) is
//  generated procedurally. Only external dependency: three.js (r128).
// =====================================================================

// ------------------------------------------------------------------
//  CORE CONSTANTS
// ------------------------------------------------------------------
let N = 128;                           // map size in tiles (set per game: 96–200)
const HUMAN = 0, AIP = 1, GAIA = 2;
const PLAYER_NAMES = ['Azure Kingdom', 'Crimson March', 'Wilds'];
const TEAM_COL = [0x3b78e0, 0xd8402c, 0xb79c62];
const TEAM_CSS = ['#5b93f5', '#ee5f48', '#c8b070'];
const RESN = ['food', 'wood', 'stone', 'gold'];
const RES_HEX = { food: 0xd8453a, wood: 0x9a6a3a, stone: 0xa6a8b0, gold: 0xf4c430 };
const POP_MAX = 100;
const CARRY_BASE = 10;
const GATHER_RATE = { berry: 0.58, carcass: 0.72, farm: 0.6, tree: 0.56, gold: 0.52, stone: 0.5, treasure: 1.2 };
const START_RES = { food: 200, wood: 200, stone: 150, gold: 100 };
const WONDER_TIME = 300;
const INTERACT = 0.8;                  // edge distance for gather / build / drop
const AGE_NAMES = ['Settlement Age', 'Feudal Age', 'Iron Age'];
const AGE_QUAL = [['lumbercamp', 'miningcamp', 'mill'], ['barracks', 'range', 'stable', 'blacksmith']];
const HOTKEYS = ['R', 'T', 'Y', 'U', 'I', 'O', 'F', 'G', 'H', 'J', 'K', 'L', 'Z', 'X', 'C', 'V', 'B', 'N'];

// ------------------------------------------------------------------
//  UNITS
// ------------------------------------------------------------------
const UNITS = {
  villager: { name: 'Villager', cls: 'villager', hp: 25, atk: 3, atkType: 'melee', marm: 0, parm: 0, range: 0.3, reload: 1.6, speed: 1.8, los: 6, radius: 0.28, cost: { food: 50 }, time: 12, age: 0,
    desc: 'Gathers resources, constructs and repairs buildings. Can garrison inside the Town Center.' },
  scout: { name: 'Scout Cavalry', cls: 'cavalry', hp: 45, atk: 4, atkType: 'melee', marm: 0, parm: 2, range: 0.35, reload: 1.9, speed: 3.2, los: 9, radius: 0.38, cost: { food: 80 }, time: 22, age: 0,
    bonus: { archer: 4, siege: 6, villager: 1 }, desc: 'Fast mounted scout with wide sight. Strong vs archers and siege.' },
  spearman: { name: 'Spearman', cls: 'infantry', hp: 45, atk: 3, atkType: 'melee', marm: 0, parm: 0, range: 0.45, reload: 2.2, speed: 1.75, los: 5, radius: 0.28, cost: { food: 35, wood: 25 }, time: 15, age: 1,
    bonus: { cavalry: 15 }, desc: 'Cheap infantry with a long spear. Counters cavalry.' },
  swordsman: { name: 'Swordsman', cls: 'infantry', hp: 60, atk: 9, atkType: 'melee', marm: 1, parm: 1, range: 0.3, reload: 2, speed: 1.7, los: 5, radius: 0.28, cost: { food: 60, gold: 20 }, time: 20, age: 1,
    bonus: { building: 3 }, desc: 'Armored melee infantry. A sturdy all-rounder.' },
  archer: { name: 'Archer', cls: 'archer', hp: 30, atk: 4, atkType: 'pierce', marm: 0, parm: 0, range: 5, reload: 2, speed: 1.9, los: 7, radius: 0.27, cost: { wood: 25, gold: 45 }, time: 22, age: 1,
    bonus: { infantry: 4, villager: 1 }, proj: 'arrow', desc: 'Ranged foot soldier. Counters infantry. Weak against cavalry.' },
  crossbow: { name: 'Crossbowman', cls: 'archer', hp: 35, atk: 5, atkType: 'pierce', marm: 0, parm: 0, range: 6, reload: 2, speed: 1.9, los: 8, radius: 0.27, cost: { wood: 25, gold: 45 }, time: 24, age: 2,
    bonus: { infantry: 4, villager: 1 }, proj: 'arrow', desc: 'Upgraded ranged infantry with a heavier bolt. Counters infantry.' },
  knight: { name: 'Knight', cls: 'cavalry', hp: 100, atk: 10, atkType: 'melee', marm: 2, parm: 2, range: 0.35, reload: 1.8, speed: 2.8, los: 6, radius: 0.42, cost: { food: 60, gold: 75 }, time: 30, age: 2,
    bonus: { archer: 6, siege: 6 }, desc: 'Heavy cavalry. Crushes archers and siege. Fears spearmen.' },
  ram: { name: 'Siege Cannon', cls: 'siege', hp: 160, atk: 4, atkType: 'melee', marm: 0, parm: 60, range: 4, reload: 4, speed: 1.0, los: 6, radius: 0.55, cost: { wood: 200, stone: 60 }, time: 36, age: 2,
    bonus: { building: 110 }, onlyBuildings: true, proj: 'stone', splash: 0.8, desc: 'Fires heavy shot at buildings and walls from short range. Nearly immune to arrows, vulnerable to melee.' },
  catapult: { name: 'Catapult', cls: 'siege', hp: 60, atk: 22, atkType: 'melee', marm: 0, parm: 6, range: 10, minRange: 2.5, reload: 6, speed: 0.9, los: 11, radius: 0.55, cost: { wood: 180, stone: 100 }, time: 40, age: 2,
    bonus: { building: 60 }, proj: 'stone', splash: 1.4, desc: 'Long-range siege engine. Area damage, great against groups and buildings.' },
  deer: { name: 'Deer', cls: 'animal', hp: 6, atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0, reload: 9, speed: 1.6, los: 4, radius: 0.32, cost: {}, time: 0, age: 9, food: 100, flee: true, desc: 'Skittish game. Flees when hunted.' },
  stag: { name: 'Stag', cls: 'animal', hp: 10, atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0, reload: 9, speed: 1.8, los: 4, radius: 0.36, cost: {}, time: 0, age: 9, food: 150, flee: true, desc: 'Large, fast game. Flees when hunted. Lots of meat.' },
  goat: { name: 'Mountain Goat', cls: 'animal', hp: 6, atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0, reload: 9, speed: 1.4, los: 4, radius: 0.3, cost: {}, time: 0, age: 9, food: 80, flee: true, desc: 'Wild goat. Flees when hunted.' },
  turkey: { name: 'Wild Turkey', cls: 'animal', hp: 4, atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0, reload: 9, speed: 1.2, los: 4, radius: 0.26, cost: {}, time: 0, age: 9, food: 60, flee: true, desc: 'Easy game bird. Flees a short distance.' },
  bull: { name: 'Wild Bull', cls: 'animal', hp: 40, atk: 5, atkType: 'melee', marm: 1, parm: 0, range: 0.35, reload: 2, speed: 1.7, los: 4, radius: 0.42, cost: {}, time: 0, age: 9, food: 220, aggressive: true, desc: 'Dangerous! Charges hunters. Send several villagers. Huge amount of meat.' },
  cow: { name: 'Cow', cls: 'animal', hp: 12, atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0, reload: 9, speed: 0.8, los: 3, radius: 0.4, cost: {}, time: 0, age: 9, food: 150, livestock: true, desc: 'Village livestock. Does not flee — easy food near your town.' },
  hen: { name: 'Chicken', cls: 'animal', hp: 3, atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0, reload: 9, speed: 0.7, los: 3, radius: 0.2, cost: {}, time: 0, age: 9, food: 40, livestock: true, desc: 'Village poultry. Does not flee — quick food.' },
};
const ANIMALS = ['deer', 'stag', 'goat', 'turkey', 'bull', 'cow', 'hen'];
const isAnimal = u => !!u && ANIMALS.includes(u.type);
const MILITARY = ['scout', 'spearman', 'swordsman', 'archer', 'crossbow', 'knight', 'ram', 'catapult'];

// ------------------------------------------------------------------
//  BUILDINGS
// ------------------------------------------------------------------
const BUILDINGS = {
  towncenter: { name: 'Town Center', size: 4, hp: 2400, marm: 3, parm: 7, cost: { wood: 275, stone: 100 }, time: 120, age: 1, pop: 5, drop: RESN, attack: { atk: 5, range: 7, reload: 2, arrows: 1 }, garrison: 15, los: 9,
    trains: ['villager', 'scout'], techs: ['loom', 'wheelbarrow', 'feudal', 'iron'], desc: 'Trains villagers, accepts all resources, shoots arrows. Villagers can garrison inside (+1 arrow each).' },
  house: { name: 'House', size: 2, hp: 550, marm: 1, parm: 6, cost: { wood: 30 }, time: 20, age: 0, pop: 5, los: 3, desc: '+5 population capacity.' },
  lumbercamp: { name: 'Lumber Camp', size: 2, hp: 600, marm: 1, parm: 6, cost: { wood: 100 }, time: 30, age: 0, drop: ['wood'], los: 4, techs: ['doublebit', 'bowsaw'], desc: 'Drop-off point for wood. Counts toward the next age.' },
  miningcamp: { name: 'Mining Camp', size: 2, hp: 600, marm: 1, parm: 6, cost: { wood: 100 }, time: 30, age: 0, drop: ['stone', 'gold'], los: 4, techs: ['goldmining', 'stonemining'], desc: 'Drop-off point for gold and stone. Counts toward the next age.' },
  mill: { name: 'Mill', size: 2, hp: 600, marm: 1, parm: 6, cost: { wood: 100 }, time: 30, age: 0, drop: ['food'], los: 4, techs: ['horsecollar'], desc: 'Drop-off point for food. Required for farms. Counts toward the next age.' },
  farm: { name: 'Farm', size: 3, hp: 300, marm: 0, parm: 0, cost: { wood: 60 }, time: 15, age: 0, walk: true, needs: 'mill', food: 200, los: 2, desc: 'Slow but steady food source worked by one villager. Expires once exhausted.' },
  barracks: { name: 'Barracks', size: 3, hp: 1200, marm: 1, parm: 7, cost: { wood: 175 }, time: 40, age: 1, los: 4, trains: ['spearman', 'swordsman'], desc: 'Trains infantry. Counts toward the next age.' },
  range: { name: 'Archery Range', size: 3, hp: 1200, marm: 1, parm: 7, cost: { wood: 175 }, time: 40, age: 1, los: 4, trains: ['archer', 'crossbow'], desc: 'Trains archers. Counts toward the next age.' },
  stable: { name: 'Stable', size: 3, hp: 1200, marm: 1, parm: 7, cost: { wood: 175 }, time: 40, age: 1, los: 4, trains: ['scout', 'knight'], desc: 'Trains cavalry. Counts toward the next age.' },
  blacksmith: { name: 'Blacksmith', size: 3, hp: 1200, marm: 1, parm: 7, cost: { wood: 150 }, time: 40, age: 1, los: 4, techs: ['forging', 'scale', 'fletching', 'padded', 'ironcasting', 'chainmail', 'bodkin', 'leather'], desc: 'Researches attack and armor upgrades. Counts toward the next age.' },
  tower: { name: 'Watch Tower', size: 2, hp: 1000, marm: 1, parm: 7, cost: { wood: 25, stone: 125 }, time: 45, age: 1, attack: { atk: 5, range: 8, reload: 2, arrows: 1 }, garrison: 5, los: 10, desc: 'Defensive tower that shoots arrows. Garrison units for extra arrows.' },
  wall: { name: 'Stone Wall', size: 1, hp: 900, marm: 8, parm: 10, cost: { stone: 5 }, time: 5, age: 1, wall: true, los: 2, desc: 'Blocks movement. Click a start and an end point to build a line.' },
  gate: { name: 'Gate', size: 1, hp: 1400, marm: 6, parm: 10, cost: { stone: 30 }, time: 15, age: 1, gate: true, los: 3, desc: 'Lets your units through, blocks enemies. Can replace a wall segment.' },
  workshop: { name: 'Siege Workshop', size: 3, hp: 1200, marm: 1, parm: 7, cost: { wood: 200 }, time: 45, age: 2, los: 4, trains: ['ram', 'catapult'], desc: 'Builds siege engines.' },
  castle: { name: 'Castle', size: 4, hp: 4800, marm: 8, parm: 11, cost: { stone: 650 }, time: 150, age: 2, attack: { atk: 8, range: 9, reload: 2, arrows: 4 }, garrison: 20, los: 11, trains: ['knight', 'crossbow'], desc: 'Mighty fortress. Fires volleys of arrows and trains elite troops.' },
  wonder: { name: 'Wonder', size: 5, hp: 4800, marm: 8, parm: 12, cost: { wood: 1000, stone: 1000, gold: 1000 }, time: 360, age: 2, los: 8, desc: 'A monument to your realm. Defend it for 5 minutes after completion to win.' },
};
const VIL_BUILDS = ['house', 'lumbercamp', 'miningcamp', 'mill', 'farm', 'towncenter', 'barracks', 'range', 'stable', 'blacksmith', 'tower', 'wall', 'gate', 'workshop', 'castle', 'wonder'];

// ------------------------------------------------------------------
//  TECHNOLOGIES
// ------------------------------------------------------------------
const TECHS = {
  feudal: { name: 'Advance to Feudal Age', icon: 'age', cost: { food: 400 }, time: 55, age: 0, ageUp: 1, desc: 'Unlocks military buildings, towers, walls and upgrades. Requires 2 of: Lumber Camp, Mining Camp, Mill.' },
  iron: { name: 'Advance to Iron Age', icon: 'age2', cost: { food: 600, gold: 150 }, time: 80, age: 1, ageUp: 2, desc: 'Unlocks siege, Knights, Crossbowmen, Castle and Wonder. Requires 2 of: Barracks, Archery Range, Stable, Blacksmith.' },
  loom: { name: 'Loom', icon: 'loom', cost: { gold: 50 }, time: 20, age: 0, desc: 'Villagers +15 HP, +1 melee / +2 pierce armor.', apply: p => { p.mod.vilHp += 15; p.mod.marm.villager += 1; p.mod.parm.villager += 2; } },
  wheelbarrow: { name: 'Wheelbarrow', icon: 'wheel', cost: { food: 150, wood: 50 }, time: 30, age: 1, desc: 'Villagers move 10% faster and carry +5.', apply: p => { p.mod.vilSpeed *= 1.1; p.mod.carry += 5; } },
  doublebit: { name: 'Double-Bit Axe', icon: 'axe', cost: { food: 100, wood: 50 }, time: 20, age: 0, desc: 'Wood gathering +20%.', apply: p => { p.mod.gather.wood *= 1.2; } },
  bowsaw: { name: 'Bow Saw', icon: 'saw', cost: { food: 150, wood: 100 }, time: 30, age: 1, req: 'doublebit', desc: 'Wood gathering +20%.', apply: p => { p.mod.gather.wood *= 1.2; } },
  goldmining: { name: 'Gold Mining', icon: 'pick', cost: { food: 100, wood: 75 }, time: 25, age: 0, desc: 'Gold mining +15%.', apply: p => { p.mod.gather.gold *= 1.15; } },
  stonemining: { name: 'Stone Mining', icon: 'pick2', cost: { food: 100, wood: 75 }, time: 25, age: 0, desc: 'Stone mining +15%.', apply: p => { p.mod.gather.stone *= 1.15; } },
  horsecollar: { name: 'Horse Collar', icon: 'plow', cost: { food: 75, wood: 75 }, time: 20, age: 1, desc: 'New farms hold +100 food.', apply: p => { p.mod.farmFood += 100; } },
  forging: { name: 'Forging', icon: 'sword', cost: { food: 150 }, time: 30, age: 1, desc: 'Infantry and cavalry +1 attack.', apply: p => { p.mod.atk.infantry++; p.mod.atk.cavalry++; } },
  scale: { name: 'Scale Armor', icon: 'shield', cost: { food: 100 }, time: 30, age: 1, desc: 'Infantry and cavalry +1 melee / +1 pierce armor.', apply: p => { for (const c of ['infantry', 'cavalry']) { p.mod.marm[c]++; p.mod.parm[c]++; } } },
  fletching: { name: 'Fletching', icon: 'arrow', cost: { food: 100, gold: 50 }, time: 30, age: 1, desc: 'Archers, towers, castles and Town Centers +1 attack and +1 range.', apply: p => { p.mod.atk.archer++; p.mod.range++; p.mod.bldAtk++; p.mod.bldRange++; } },
  padded: { name: 'Padded Archer Armor', icon: 'shield2', cost: { food: 100 }, time: 30, age: 1, desc: 'Archers +1 melee / +1 pierce armor.', apply: p => { p.mod.marm.archer++; p.mod.parm.archer++; } },
  ironcasting: { name: 'Iron Casting', icon: 'sword2', cost: { food: 220, gold: 120 }, time: 45, age: 2, req: 'forging', desc: 'Infantry and cavalry +1 attack.', apply: p => { p.mod.atk.infantry++; p.mod.atk.cavalry++; } },
  chainmail: { name: 'Chain Mail', icon: 'shield3', cost: { food: 200, gold: 100 }, time: 45, age: 2, req: 'scale', desc: 'Infantry and cavalry +1 melee / +1 pierce armor.', apply: p => { for (const c of ['infantry', 'cavalry']) { p.mod.marm[c]++; p.mod.parm[c]++; } } },
  bodkin: { name: 'Bodkin Arrow', icon: 'arrow2', cost: { food: 200, gold: 100 }, time: 45, age: 2, req: 'fletching', desc: 'Archers, towers, castles and Town Centers +1 attack and +1 range.', apply: p => { p.mod.atk.archer++; p.mod.range++; p.mod.bldAtk++; p.mod.bldRange++; } },
  leather: { name: 'Leather Archer Armor', icon: 'shield4', cost: { food: 150, gold: 150 }, time: 45, age: 2, req: 'padded', desc: 'Archers +1 melee / +1 pierce armor.', apply: p => { p.mod.marm.archer++; p.mod.parm.archer++; } },
};

// ------------------------------------------------------------------
//  SETTINGS (persisted)
// ------------------------------------------------------------------
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 820;
const Settings = { quality: IS_MOBILE ? 'low' : 'medium', volume: 70, music: 45, edgeScroll: !IS_TOUCH, autoWork: true, timeMode: 'cycle', weather: 'dynamic', tips: true, autoQuality: true };
try { Object.assign(Settings, JSON.parse(localStorage.getItem('ironvale.settings') || '{}')); } catch (e) { /* storage unavailable */ }
if (Settings.colorblind) { TEAM_COL[0] = 0x2a6fe0; TEAM_CSS[0] = '#5b9bff'; TEAM_COL[1] = 0xff9a1a; TEAM_CSS[1] = '#ffa733'; } // blue vs orange
function saveSettings() { try { localStorage.setItem('ironvale.settings', JSON.stringify(Settings)); } catch (e) { /* ignore */ } }
const GameOpts = { difficulty: 'standard', seed: (Math.random() * 900000 + 100000) | 0, speed: 1, theme: 'vale', size: 'normal', pf: 'azure', ef: 'random', boost: 1 };

// ------------------------------------------------------------------
//  UTILITIES
// ------------------------------------------------------------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => (a + Math.random() * (b - a + 1)) | 0;
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const idx = (x, y) => y * N + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
function fmtTime(s) { s = Math.max(0, s | 0); const m = (s / 60) | 0, r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function makeNoise(rng) {
  const perm = new Uint8Array(512), vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rng(); }
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const sm = t => t * t * (3 - 2 * t);
  const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = sm(xf), w = sm(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), w);
  }
  return function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * a; t += a; a *= 0.5; f *= 2.03; } return s / t; };
}
class MinHeap {
  constructor(cap) { this.a = new Int32Array(cap); this.k = new Float32Array(cap); this.n = 0; }
  clear() { this.n = 0; }
  push(v, key) {
    if (this.n >= this.a.length) return;
    let i = this.n++; const a = this.a, k = this.k;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; a[i] = a[p]; k[i] = k[p]; i = p; }
    a[i] = v; k[i] = key;
  }
  pop() {
    const a = this.a, k = this.k; const top = a[0]; const n = --this.n;
    if (n > 0) {
      const v = a[n], key = k[n]; let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= key) break; a[i] = a[c]; k[i] = k[c]; i = c; }
      a[i] = v; k[i] = key;
    }
    return top;
  }
}
function canAfford(p, cost) { for (const r in cost) if (Math.floor(p.res[r]) < cost[r]) return false; return true; }
function missingRes(p, cost) { for (const r in cost) if (Math.floor(p.res[r]) < cost[r]) return r; return null; }
function pay(p, cost) { for (const r in cost) p.res[r] = Math.max(0, p.res[r] - cost[r]); }
function refund(p, cost) { for (const r in cost) p.res[r] += cost[r]; }
function scaleCost(cost, f) { const o = {}; for (const r in cost) o[r] = Math.round(cost[r] * f); return o; }

// ------------------------------------------------------------------
//  PLAYERS
// ------------------------------------------------------------------
function newMod() {
  return { atk: { infantry: 0, cavalry: 0, archer: 0 }, marm: { infantry: 0, cavalry: 0, archer: 0, villager: 0 }, parm: { infantry: 0, cavalry: 0, archer: 0, villager: 0 },
    hpMul: {}, spd: {}, kind: {}, bldHp: 1, range: 0, bldAtk: 0, bldRange: 0, gather: { food: 1, wood: 1, stone: 1, gold: 1 }, carry: 0, vilSpeed: 1, vilHp: 0, farmFood: 0 };
}
let players = [];
function makePlayer(id, isAI) {
  return { id, isAI, name: PLAYER_NAMES[id], res: Object.assign({}, START_RES), age: 0, pop: 0, popCap: 0, techs: new Set(), researching: new Set(), mod: newMod(), ver: 1, uc: {},
    gatherMul: 1, boost: 1, stats: { gathered: { food: 0, wood: 0, stone: 0, gold: 0 }, trained: 0, lost: 0, bldLost: 0, bldDestroyed: 0, kills: 0 },
    vis: new Uint8Array(N * N), exp: new Uint8Array(N * N), alive: true, lastAlarm: -99, idleCount: 0 };
}
// effective unit stats for a player (cached until a tech completes)
function ustat(owner, type) {
  const p = players[owner];
  if (p.uc.ver !== p.ver) p.uc = { ver: p.ver };
  let s = p.uc[type];
  if (s) return s;
  const d = UNITS[type], m = p.mod;
  s = Object.assign({}, d);
  s.bonus = d.bonus || {};
  if (m.atk[d.cls] !== undefined) s.atk += m.atk[d.cls];
  if (m.marm[d.cls] !== undefined) s.marm += m.marm[d.cls];
  if (m.parm[d.cls] !== undefined) s.parm += m.parm[d.cls];
  if (d.cls === 'archer') s.range += m.range;
  if (m.hpMul[d.cls]) s.hp = Math.round(s.hp * m.hpMul[d.cls]);
  if (m.spd[d.cls] || m.spd.all) s.speed *= m.spd[d.cls] || m.spd.all;
  if (type === 'villager') { s.hp += m.vilHp; s.speed *= m.vilSpeed; }
  p.uc[type] = s;
  return s;
}
function bstat(owner, type) {
  const d = BUILDINGS[type], p = players[owner];
  if (!d.attack) return null;
  return { atk: d.attack.atk + p.mod.bldAtk, atkType: 'pierce', range: d.attack.range + p.mod.bldRange, reload: d.attack.reload, arrows: d.attack.arrows, bonus: {} };
}
