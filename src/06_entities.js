// =====================================================================
//  ENTITIES — units, buildings, economy, combat, production
// =====================================================================
let ents = new Map(), nextId = 1;
let units = [], buildings = [], resources = [], projectiles = [];

// ---------------- spatial hash for units ----------------
const HC = 4;
let HN = Math.ceil(N / HC);
let hashCells = Array.from({ length: HN * HN }, () => []);
function allocHash() { HN = Math.ceil(N / HC); hashCells = Array.from({ length: HN * HN }, () => []); }
function rebuildHash() {
  for (let i = 0; i < hashCells.length; i++) hashCells[i].length = 0;
  for (const u of units) { if (u.dead || u.garrisonIn) continue; const cx = clamp((u.x / HC) | 0, 0, HN - 1), cz = clamp((u.z / HC) | 0, 0, HN - 1); hashCells[cz * HN + cx].push(u); }
}
function forUnitsNear(x, z, r, fn) {
  const x0 = clamp(((x - r) / HC) | 0, 0, HN - 1), x1 = clamp(((x + r) / HC) | 0, 0, HN - 1), z0 = clamp(((z - r) / HC) | 0, 0, HN - 1), z1 = clamp(((z + r) / HC) | 0, 0, HN - 1);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) { const c = hashCells[cz * HN + cx]; for (let i = 0; i < c.length; i++) fn(c[i]); }
}

// ---------------- helpers ----------------
const isMil = u => MILITARY.includes(u.type);
const isEnemy = (a, b) => a <= 1 && b <= 1 && a !== b;
function edgeDist(u, t) {
  if (t.kind === 'unit') return Math.sqrt(dist2(u.x, u.z, t.x, t.z)) - UNITS[u.type].radius - UNITS[t.type].radius;
  const s = t.size; const px = clamp(u.x, t.tx, t.tx + s), pz = clamp(u.z, t.ty, t.ty + s);
  return Math.sqrt(dist2(u.x, u.z, px, pz)) - UNITS[u.type].radius;
}
function rectDist(x, z, t) { const s = t.size; const px = clamp(x, t.tx, t.tx + s), pz = clamp(z, t.ty, t.ty + s); return Math.sqrt(dist2(x, z, px, pz)); }
function faceTo(u, x, z) { u.faceTo = Math.atan2(x - u.x, z - u.z); }
function unitSpeed(u, s) { let sp = s.speed; if (u.groupSpeed > 0) sp = Math.min(sp, u.groupSpeed); return sp; }
function bldTopY(b) { return b.y + (b.size >= 3 ? 1.6 : 1.1) + (b.type === 'tower' ? 1.6 : 0) + (b.type === 'castle' ? 1.0 : 0); }

// ---------------- units ----------------
function spawnUnit(type, owner, x, z) {
  if (!posFree(x, z, owner)) { const nf = nearestFree(x, z, owner, 14); if (nf) { x = nf.x; z = nf.z; } }
  const s = ustat(owner, type);
  const u = { id: nextId++, kind: 'unit', type, owner, x, z, hp: s.hp, maxHp: s.hp, state: 'idle', facing: Math.random() * 6.28, faceTo: null, path: null, pi: 0, target: 0, cool: 0, carry: 0, carryType: null,
    gres: null, gkind: null, gtarget: 0, btarget: 0, walk: Math.random() * 6, swing: 0, work: 0, moving: false, dead: false, dieT: 0, garrisonIn: 0, scanT: Math.random(), stuckT: 0, repathT: 0,
    home: { x, z }, groupSpeed: 0, navId: 0, navTries: 0, sfxT: Math.random(), bad: null, amove: null, wanderT: rand(1, 5), fleeT: 0 };
  ents.set(u.id, u); units.push(u);
  return u;
}
function clearOrders(u) {
  u.target = 0; u.gtarget = 0; u.btarget = 0; u.amove = null; u.path = null; u.pathReq = null; u.waitPath = false;
  u.autoTgt = false; u.navId = 0; u.navTries = 0; u.groupSpeed = 0; u.moveTries = 0; u.dropId = 0; u.parked = false;
}
function orderMove(u, x, z, groupSpeed) {
  if (u.dead || u.garrisonIn) return;
  clearOrders(u); u.state = 'move'; u.goal = { x, z }; u.groupSpeed = groupSpeed || 0; requestPath(u, x, z);
}
function orderAttackMove(u, x, z) {
  if (u.dead || u.garrisonIn) return;
  clearOrders(u); u.state = 'amove'; u.amove = { x, z }; requestPath(u, x, z);
}
function orderAttack(u, t, keepAmove) {
  if (u.dead || u.garrisonIn || !t || t === u) return;
  const s = UNITS[u.type];
  if (s.onlyBuildings && t.kind !== 'building') { orderMove(u, t.x, t.z); return; }
  const am = keepAmove ? u.amove : null;
  clearOrders(u); u.amove = am; u.state = 'attack'; u.target = t.id; u.home = { x: u.x, z: u.z }; u.chaseFail = 0; u.chaseLast = undefined;
}
function orderGather(u, r) {
  if (u.dead || u.garrisonIn || u.type !== 'villager' || !r) return;
  clearOrders(u); u.state = 'gather'; u.gtarget = r.id;
  if (r.kind === 'unit') { u.gres = 'food'; u.gkind = 'hunt'; }
  else if (r.kind === 'building') { u.gres = 'food'; u.gkind = 'farm'; }
  else { u.gres = r.res; u.gkind = r.rtype === 'carcass' ? 'hunt' : r.rtype; }
  u.bad = null;
}
function orderBuild(u, b) { if (u.dead || u.garrisonIn || u.type !== 'villager') return; const prevG = (u.state === 'gather' || u.state === 'return') ? u.gtarget : u.state === 'build' ? u.resumeG : 0; clearOrders(u); u.state = 'build'; u.btarget = b.id; u.resumeG = prevG; }
function orderGarrison(u, b) { if (u.dead || u.garrisonIn) return; clearOrders(u); u.state = 'garrison'; u.btarget = b.id; }
function orderStop(u) { if (u.dead || u.garrisonIn) return; clearOrders(u); u.state = 'idle'; u.home = { x: u.x, z: u.z }; }
function startReturn(u) { u.state = 'return'; u.dropId = 0; u.path = null; u.navId = 0; u.waitPath = false; u.pathReq = null; }

// path following; returns 'arrived' | 'moving' | 'waiting'
function followPath(u, dt, speed) {
  if (u.waitPath) return 'waiting';
  if (!u.path || u.pi >= u.path.length) return 'arrived';
  const wp = u.path[u.pi]; const dx = wp.x - u.x, dz = wp.z - u.z; const d = Math.sqrt(dx * dx + dz * dz);
  const last = u.pi === u.path.length - 1;
  if (d < (last ? 0.1 : 0.3)) { u.pi++; return u.pi >= u.path.length ? 'arrived' : 'moving'; }
  const step = Math.min(d, speed * dt);
  u.faceTo = Math.atan2(dx, dz);
  moveUnit(u, dx / d * step, dz / d * step);
  u.walk += dt * speed * 6.5;
  u.stuckT += dt;
  if (u.stuckT > 1.0) {
    const moved = Math.sqrt(dist2(u.x, u.z, u.lastProgX, u.lastProgZ));
    u.stuckT = 0; u.lastProgX = u.x; u.lastProgZ = u.z;
    if (moved < 0.25 * speed) { u.stuck = (u.stuck || 0) + 1; u.path = null; return 'arrived'; }
    u.stuck = 0;
  }
  return 'moving';
}
function moveUnit(u, dx, dz) {
  const nx = u.x + dx, nz = u.z + dz;
  if (posFree(nx, nz, u.owner)) { u.x = nx; u.z = nz; }
  else if (Math.abs(dx) > 1e-4 && posFree(nx, u.z, u.owner)) u.x = nx;
  else if (Math.abs(dz) > 1e-4 && posFree(u.x, nz, u.owner)) u.z = nz;
  else return false;
  u.moving = true; return true;
}
// go to an entity (building/resource). returns 'moving' or 'fail'
function navToEnt(u, e, dt, s) {
  if (u.navId !== e.id) { u.navId = e.id; u.navTries = 0; requestPath(u, e.x, e.z, e); return 'moving'; }
  if (!u.path && !u.waitPath) {
    if (++u.navTries > 4) { u.navId = 0; return 'fail'; }
    requestPath(u, e.x, e.z, e); return 'moving';
  }
  const r = followPath(u, dt, unitSpeed(u, s));
  if (r === 'arrived') u.path = null;
  return 'moving';
}
function navToPoint(u, x, z, dt, s) {
  const far = !u.navGoal || dist2(u.navGoal.x, u.navGoal.z, x, z) > 2.25;
  if (((!u.path && !u.waitPath) || far) && u.repathT <= 0) {
    u.navGoal = { x, z }; u.repathT = 0.6;
    if (lineFree(u.x, u.z, x, z, u.owner)) { u.path = [{ x, z }]; u.pi = 0; u.stuckT = 0; u.lastProgX = u.x; u.lastProgZ = u.z; }
    else requestPath(u, x, z);
  }
  const r = followPath(u, dt, unitSpeed(u, s));
  if (r === 'arrived') u.path = null;
}

function findEnemyNear(u, r, onlyB) {
  let best = null, bd = r * r;
  const vis = players[u.owner].vis;
  if (!onlyB) forUnitsNear(u.x, u.z, r, o => {
    if (o.dead || !isEnemy(u.owner, o.owner)) return;
    const d = dist2(u.x, u.z, o.x, o.z);
    if (d < bd && vis[idx(o.x | 0, o.z | 0)]) { bd = d; best = o; }
  });
  if (best) return best;
  let bb = null, bbd = r;
  for (const b of buildings) {
    if (b.dead || !isEnemy(u.owner, b.owner)) continue;
    if (Math.abs(b.x - u.x) > r + 3 || Math.abs(b.z - u.z) > r + 3) continue;
    const d = rectDist(u.x, u.z, b);
    if (d < bbd && (!onlyB || true)) { bbd = d; bb = b; }
  }
  return bb;
}
function validTarget(u, t) {
  return t && !t.dead && t.hp > 0 && !t.garrisonIn && t.owner !== u.owner && (t.kind === 'unit' || t.kind === 'building');
}

// ---------------- unit update ----------------
function updateUnit(u, dt) {
  if (u.dead) { u.dieT += dt; return; }
  if (u.garrisonIn) { u.hp = Math.min(u.maxHp, u.hp + dt * 0.5); return; }
  const s = ustat(u.owner, u.type);
  u.cool -= dt; u.repathT -= dt; u.swing = Math.max(0, u.swing - dt * 2.2); u.moving = false; u.working = false;
  u.idleT = u.state === 'idle' ? (u.idleT || 0) + dt : 0;
  if (u.hitT > 0) u.hitT -= dt;
  if (!posFree(u.x, u.z, u.owner)) { const nf = nearestFree(u.x, u.z, u.owner, 8); if (nf) { u.x = nf.x; u.z = nf.z; } }
  if (s.heal) healTick(u, dt, s);
  if (isAnimal(u)) updateAnimal(u, dt, s);
  else switch (u.state) {
    case 'idle': {
      if (isMil(u)) {
        u.scanT -= dt;
        if (u.scanT <= 0) {
          u.scanT = 0.45 + Math.random() * 0.3;
          const e = findEnemyNear(u, s.los, s.onlyBuildings);
          if (e) { u.state = 'attack'; u.target = e.id; u.autoTgt = true; u.home = { x: u.x, z: u.z }; }
        }
      }
      break;
    }
    case 'move': {
      const r = followPath(u, dt, unitSpeed(u, s));
      if (r === 'arrived') {
        u.path = null;
        const d = Math.sqrt(dist2(u.x, u.z, u.goal.x, u.goal.z));
        if (d < 1.0 || (u.moveTries || 0) >= 3 || u.pathOk === false) { u.state = 'idle'; u.groupSpeed = 0; u.home = { x: u.x, z: u.z }; }
        else { u.moveTries = (u.moveTries || 0) + 1; requestPath(u, u.goal.x, u.goal.z); }
      }
      break;
    }
    case 'amove': {
      u.scanT -= dt;
      if (u.scanT <= 0) {
        u.scanT = 0.4 + Math.random() * 0.2;
        const e = findEnemyNear(u, s.los + 1, s.onlyBuildings);
        if (e) { u.state = 'attack'; u.target = e.id; u.autoTgt = false; u.path = null; u.navId = 0; break; }
      }
      const r = followPath(u, dt, unitSpeed(u, s));
      if (r === 'arrived') {
        u.path = null;
        const d = Math.sqrt(dist2(u.x, u.z, u.amove.x, u.amove.z));
        if (d < 2 || (u.moveTries || 0) >= 4) { u.state = 'idle'; u.amove = null; u.home = { x: u.x, z: u.z }; }
        else { u.moveTries = (u.moveTries || 0) + 1; requestPath(u, u.amove.x, u.amove.z); }
      }
      break;
    }
    case 'attack': updateAttack(u, dt, s); break;
    case 'gather': updateGather(u, dt, s); break;
    case 'return': updateReturn(u, dt, s); break;
    case 'build': updateBuild(u, dt, s); break;
    case 'garrison': updateGarrisonMove(u, dt, s); break;
  }
  // smooth turn
  if (u.faceTo !== null && u.faceTo !== undefined) {
    let da = u.faceTo - u.facing; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    u.facing += da * Math.min(1, dt * 10);
  }
  if (u.moving && (u.type === 'scout' || u.type === 'knight')) { u.sfxT -= dt; if (u.sfxT <= 0) { u.sfxT = 0.6; Sound.play('gallop', u.x, u.z, 0.5); } }
}
function healTick(u, dt, s) {
  u.healScan = (u.healScan || 0) - dt;
  if (u.healScan <= 0) {
    u.healScan = 0.5; let best = null, bf = 0.999;
    forUnitsNear(u.x, u.z, s.healRange, o => { if (o.dead || o.owner !== u.owner || o.garrisonIn || isAnimal(o)) return; const f = o.hp / o.maxHp; if (f < bf && dist2(o.x, o.z, u.x, u.z) <= s.healRange * s.healRange) { bf = f; best = o; } });
    u.healTgt = best ? best.id : 0;
  }
  const t = u.healTgt ? ents.get(u.healTgt) : null;
  if (t && !t.dead && t.hp < t.maxHp) {
    t.hp = Math.min(t.maxHp, t.hp + s.heal * dt); u.working = true; u.work += dt; faceTo(u, t.x, t.z);
    if (Math.random() < dt * 4) PFX.add.emit(t.x + rand(-0.2, 0.2), heightAt(t.x, t.z) + 0.5, t.z + rand(-0.2, 0.2), 0, 0.8, 0, 0.8, 0.12, 0.4, 1, 0.5, 0.9, 0, 0);
  }
}
function afterTargetLost(u, s) {
  u.target = 0; u.path = null; u.navId = 0;
  if (u.amove) { u.state = 'amove'; u.moveTries = 0; requestPath(u, u.amove.x, u.amove.z); return; }
  if (isMil(u)) {
    const e = findEnemyNear(u, s.los, s.onlyBuildings);
    if (e) { u.target = e.id; u.state = 'attack'; return; }
  }
  u.state = 'idle'; u.autoTgt = false;
}
function updateAttack(u, dt, s) {
  const t = ents.get(u.target);
  if (!validTarget(u, t)) return afterTargetLost(u, s);
  if (s.onlyBuildings && t.kind !== 'building') return afterTargetLost(u, s);
  const d = edgeDist(u, t);
  if (d <= s.range + 0.12 && !(s.minRange && d < s.minRange)) {
    u.path = null; u.waitPath = false; faceTo(u, t.x, t.z);
    if (u.cool <= 0) { u.cool = s.reload; u.swing = 1; doAttack(u, s, t); }
    return;
  }
  if (s.minRange && d < s.minRange) {
    const dx = u.x - t.x, dz = u.z - t.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
    moveUnit(u, dx / l * s.speed * dt, dz / l * s.speed * dt); u.walk += dt * 5;
    return;
  }
  if (u.autoTgt && !u.amove && Math.sqrt(dist2(u.x, u.z, u.home.x, u.home.z)) > s.los * 1.6 + 5) { u.target = 0; orderMove(u, u.home.x, u.home.z); return; }
  if (t.kind === 'unit') {
    // give up on units we cannot get closer to (e.g. sealed behind trees)
    u.chaseChk = (u.chaseChk || 0) + dt;
    if (u.chaseChk > 2) { u.chaseChk = 0; if (u.chaseLast !== undefined && u.chaseLast - d < 0.3) u.chaseFail = (u.chaseFail || 0) + 1; else u.chaseFail = 0; u.chaseLast = d; }
    if ((u.chaseFail || 0) >= 3) { u.chaseFail = 0; u.chaseLast = undefined; (u.unreach || (u.unreach = new Set())).add(t.id); return afterTargetLost(u, s); }
    navToPoint(u, t.x, t.z, dt, s);
  }
  else if (navToEnt(u, t, dt, s) === 'fail') afterTargetLost(u, s);
}
function doAttack(u, s, t) {
  if (s.proj) {
    const y = heightAt(u.x, u.z) + (s.proj === 'stone' ? 0.6 : 0.55);
    spawnProjectile(s.proj, u.owner, u.x, y, u.z, t, s, 0.05, u.id);
    Sound.play(u.type === 'ram' ? 'cannon' : s.proj === 'stone' ? 'launch' : 'arrow', u.x, u.z, 0.8);
  } else {
    applyDamage(t, calcDamage(s, t), u);
    if (t.kind === 'unit') Sound.play(isMil(t) && isMil(u) ? 'sword' : 'hit', u.x, u.z, 0.7);
    else { Sound.play(u.type === 'ram' ? 'stone' : 'hit', u.x, u.z, 0.7); PFX.dust(t.x + (u.x - t.x) * 0.5, heightAt(u.x, u.z) + 0.4, t.z + (u.z - t.z) * 0.5, 2, 0.3); }
  }
}
function calcDamage(s, t) {
  let cls, marm, parm;
  if (t.kind === 'unit') { const ts = ustat(t.owner, t.type); cls = ts.cls; marm = ts.marm; parm = ts.parm; }
  else { const d = BUILDINGS[t.type], L = (t.level || 1) - 1; cls = 'building'; marm = d.marm + L + (t.built ? 0 : -2); parm = d.parm + L + (t.built ? 0 : -4); }
  const arm = s.atkType === 'pierce' ? parm : marm;
  return Math.max(1, s.atk + ((s.bonus && s.bonus[cls]) || 0) - arm);
}
function applyDamage(t, dmg, attacker, attackerOwner) {
  if (!t || t.dead) return;
  t.hp -= dmg;
  const ao = attacker ? attacker.owner : (attackerOwner !== undefined ? attackerOwner : -1);
  if (t.owner <= 1 && isEnemy(ao, t.owner)) onAttacked(t, attacker);
  if (t.kind === 'unit') {
    t.hitT = 0.24;
    if (Game.mode === 'play' && players[HUMAN].vis[idx(t.x | 0, t.z | 0)]) { PFX.blood(t.x, heightAt(t.x, t.z) + 0.45, t.z); Sound.battle(0.05); }
    if (isAnimal(t) && attacker) {
      const ad = UNITS[t.type];
      if (ad.flee) { t.fleeT = t.type === 'turkey' ? 1.5 : 3; t.fleeFrom = { x: attacker.x, z: attacker.z }; }
      else if (ad.aggressive && attacker.kind === 'unit' && !attacker.dead && t.hp > 0) { if (t.state !== 'attack') Sound.play(/trex|raptor|tricer|stego|rhino|elephant/.test(t.type) ? 'roar' : 'growl', t.x, t.z, 0.9); t.state = 'attack'; t.target = attacker.id; if (Game.mode === 'play' && attacker.owner === HUMAN) UI.notify('The bull charges your hunters!', 'warn', 'bull'); }
    }
    else if (attacker && attacker.kind === 'unit' && t.hp > 0 && isMil(t) && (t.state === 'idle' || (t.state === 'amove' && attacker.owner === GAIA)) && !attacker.dead) {
      const ts = ustat(t.owner, t.type);
      if (!(ts.onlyBuildings)) { t.state = 'attack'; t.target = attacker.id; t.autoTgt = !t.amove; t.home = { x: t.x, z: t.z }; }
    }
  }
  if (t.hp <= 0) { t.hp = 0; if (t.kind === 'unit') killUnit(t, ao); else destroyBuilding(t, ao); }
}
function onAttacked(t, attacker) {
  const p = players[t.owner];
  if (p.isAI) { const ai = AIs.find(a => a.pid === t.owner); if (ai) ai.onAttacked(t, attacker); return; }
  if (Game.mode !== 'play') return;
  const key = (t.kind === 'building' || t.type === 'villager') ? 'base' : 'army';
  p.alarm = p.alarm || {};
  if (Game.time - (p.alarm[key] || -99) > 25) {
    p.alarm[key] = Game.time;
    UI.notify(key === 'base' ? 'Your base is under attack!' : 'Your army is under attack!', 'warn', undefined, { x: t.x, z: t.z }); Post.hit();
    if (isEnemy(attacker ? attacker.owner : -1, HUMAN)) Story.event('attacked');
    Minimap.ping(t.x, t.z);
    Sound.play('alarm');
  }
  Sound.battle(0.12);
}
function killUnit(u, killerOwner) {
  if (u.dead) return;
  u.dead = true; u.state = 'dead'; u.dieT = 0; u.hp = 0; u.path = null;
  if (u.owner <= 1) players[u.owner].stats.lost++;
  if (u.owner <= 1 && killerOwner >= 0 && killerOwner <= 1 && killerOwner !== u.owner) players[killerOwner].stats.kills++;
  const ud = UNITS[u.type];
  if (u.owner === GAIA && killerOwner >= 0 && killerOwner <= 1) {
    const kp = players[killerOwner];
    if (ud.bounty) { kp.res.gold += ud.bounty; kp.stats.gathered.gold += ud.bounty; if (killerOwner === HUMAN && Game.mode === 'play') UI.floatText(u.x, heightAt(u.x, u.z) + 1.2, u.z, '+' + ud.bounty, 'gold'); }
    if (ud.boss) { kp.stats.bosses = (kp.stats.bosses || 0) + 1; if (Game.mode === 'play') { UI.notify((killerOwner === HUMAN ? 'You slew ' : players[killerOwner].name + ' slew ') + ud.name + '!', killerOwner === HUMAN ? 'good' : 'warn'); if (killerOwner === HUMAN) Story.event('boss'); } }
  }
  if (isAnimal(u) && UNITS[u.type].food > 0) {
    // what the animal leaves behind: salmon for water creatures, a ham for big beasts, a steak otherwise
    const food = UNITS[u.type].food, mm = ['seal', 'turtle', 'crab', 'duck', 'frog'].includes(u.type) ? 'meat_fish' : food >= 200 ? 'meat_ham' : 'meat_steak';
    const c = spawnResource({ rtype: 'carcass', tx: clamp(Math.floor(u.x), 0, N - 1), ty: clamp(Math.floor(u.z), 0, N - 1), size: 1, amount: food, model: hasModel(mm) ? mm : undefined });
    c.scale = clamp(0.8 + food / 300, 0.85, 2.6); c.rot = Math.random() * 6.28; setResInstance(c, true);
    c.x = u.x; c.z = u.z; u.carcassId = c.id;
  } else Sound.play('death', u.x, u.z, 0.6);
  for (const b of buildings) if (b.farmer === u.id) b.farmer = 0;
}

function updateAnimal(u, dt, s) {
  const d = UNITS[u.type];
  if (d.hostile && u.state !== 'attack') {
    u.scanT -= dt;
    if (u.scanT <= 0) {
      u.scanT = 0.5 + Math.random() * 0.2;
      let best = null, bd = d.hostile * d.hostile;
      forUnitsNear(u.home.x, u.home.z, d.hostile + 1, o => { if (o.dead || o.owner > 1 || o.garrisonIn) return; const dd = dist2(o.x, o.z, u.home.x, u.home.z); if (dd < bd) { bd = dd; best = o; } });
      if (best) { u.state = 'attack'; u.target = best.id; u.path = null; Sound.play(/wolf/.test(u.type) ? 'howl' : /trex|raptor/.test(u.type) ? 'roar' : /skeleton/.test(u.type) ? 'rattle' : /pirate/.test(u.type) ? 'sword' : 'growl', u.x, u.z, 0.9); if (best.owner === HUMAN && Game.mode === 'play' && d.boss) UI.notify(d.name + ' attacks!', 'warn', 'boss' + u.id); }
    }
  }
  // wild bull: charges whoever hurt it, gives up when lured away from its pasture
  if (d.aggressive && u.state === 'attack') {
    const t = ents.get(u.target);
    if (!t || t.dead || t.garrisonIn || Math.sqrt(dist2(u.x, u.z, u.home.x, u.home.z)) > 9) { u.state = 'idle'; u.target = 0; u.path = null; u.wanderT = 0; return; }
    const dd = edgeDist(u, t);
    if (dd <= s.range + 0.15) { u.path = null; faceTo(u, t.x, t.z); if (u.cool <= 0) { u.cool = s.reload; u.swing = 1; applyDamage(t, calcDamage(s, t), u); Sound.play('hit', u.x, u.z, 0.8); } }
    else { navToPoint(u, t.x, t.z, dt, s); u.walk += dt * 3; }
    return;
  }
  if (u.fleeT > 0) {
    u.fleeT -= dt;
    const dx = u.x - u.fleeFrom.x, dz = u.z - u.fleeFrom.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
    if (moveUnit(u, dx / l * s.speed * dt, dz / l * s.speed * dt)) { u.walk += dt * 9; u.faceTo = Math.atan2(dx, dz); }
    else u.fleeT = 0;
    return;
  }
  u.wanderT -= dt;
  if (u.wanderT <= 0) {
    const r = d.cls === 'creep' || d.hostile ? 1.5 : d.livestock ? 2 : 3;
    u.wanderT = d.livestock ? rand(3, 7) : rand(4, 10);
    const tx = u.home.x + rand(-r, r), tz = u.home.z + rand(-r, r);
    if (lineFree(u.x, u.z, tx, tz, GAIA)) { u.path = [{ x: tx, z: tz }]; u.pi = 0; u.stuckT = 0; u.lastProgX = u.x; u.lastProgZ = u.z; }
  }
  if (followPath(u, dt, s.speed * (d.livestock ? 0.5 : 0.35)) === 'arrived') u.path = null;
}

// ---------------- economy ----------------
function findGatherTarget(u, gkind, radius) {
  const bad = u.bad;
  let best = null, bd = radius * radius;
  if (gkind === 'farm') return findFreeFarm(u, radius);
  for (const r of resources) {
    if (r.dead || r.amount <= 0) continue;
    if (gkind === 'hunt' ? r.rtype !== 'carcass' : r.rtype !== gkind) continue;
    const d = dist2(u.x, u.z, r.x, r.z);
    if (d < bd && !(bad && bad.has(r.id))) { bd = d; best = r; }
  }
  if (!best && gkind === 'hunt') {
    forUnitsNear(u.x, u.z, radius, o => { const od = UNITS[o.type]; if (isAnimal(o) && od.cls === 'animal' && od.food > 0 && !od.aggressive && !od.hostile && !o.dead && !(bad && bad.has(o.id))) { const d = dist2(u.x, u.z, o.x, o.z); if (d < bd) { bd = d; best = o; } } });
  }
  return best;
}
function findFreeFarm(u, radius = 30) {
  let best = null, bd = radius * radius;
  for (const b of buildings) {
    if (b.type !== 'farm' || b.dead || !b.built || b.owner !== u.owner) continue;
    if (b.farmer && b.farmer !== u.id) { const f = ents.get(b.farmer); if (f && !f.dead && f.gtarget === b.id && (f.state === 'gather' || f.state === 'return')) continue; }
    const d = dist2(u.x, u.z, b.x, b.z); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function nearestDrop(owner, res, x, z) {
  let best = null, bd = Infinity;
  for (const b of buildings) {
    if (b.owner !== owner || b.dead || !b.built) continue;
    const d = BUILDINGS[b.type].drop; if (!d || !d.includes(res)) continue;
    const dd = rectDist(x, z, b); if (dd < bd) { bd = dd; best = b; }
  }
  return best;
}
function updateGather(u, dt, s) {
  const p = players[u.owner];
  let r = ents.get(u.gtarget);
  if (r && r.kind === 'unit') {
    if (r.dead) { r = r.carcassId ? ents.get(r.carcassId) : null; if (r) u.gtarget = r.id; }
    else {
      const d = edgeDist(u, r);
      if (d <= 2.6) {
        u.path = null; faceTo(u, r.x, r.z);
        if (u.cool <= 0) { u.cool = 1.5; u.swing = 1; spawnProjectile('spear', u.owner, u.x, heightAt(u.x, u.z) + 0.55, u.z, r, { atk: 4, atkType: 'pierce', bonus: {} }, 0, u.id); }
      } else {
        u.chaseChk = (u.chaseChk || 0) + dt;
        if (u.chaseChk > 2) { u.chaseChk = 0; if (u.chaseLast !== undefined && u.chaseLast - d < 0.3) u.chaseFail = (u.chaseFail || 0) + 1; else u.chaseFail = 0; u.chaseLast = d; }
        if ((u.chaseFail || 0) >= 3) { u.chaseFail = 0; u.chaseLast = undefined; (u.bad || (u.bad = new Set())).add(r.id); u.gtarget = 0; return; }
        navToPoint(u, r.x, r.z, dt, s);
      }
      return;
    }
  }
  if (!r || r.dead || r.amount <= 0.001 || (r.kind === 'building' && !r.built)) {
    const nr = findGatherTarget(u, u.gkind, u.gkind === 'farm' ? 30 : u.gkind === 'hunt' ? 20 : 9);
    if (nr) { u.gtarget = nr.id; u.navId = 0; u.path = null; return; }
    if (u.carry > 0) { startReturn(u); u.gtarget = 0; return; }
    u.state = 'idle'; u.gtarget = 0; return;
  }
  const rt = r.kind === 'building' ? 'food' : r.res;
  if (u.carry > 0 && u.carryType !== rt) u.carry = 0;
  const cap = CARRY_BASE + p.mod.carry;
  if (u.carry >= cap - 0.001) { startReturn(u); return; }
  if (r.kind === 'building') {
    if (r.farmer && r.farmer !== u.id) {
      const f = ents.get(r.farmer);
      if (f && !f.dead && f.gtarget === r.id && (f.state === 'gather' || f.state === 'return')) {
        const ff = findFreeFarm(u); if (ff) { u.gtarget = ff.id; u.navId = 0; return; }
        u.state = 'idle'; return;
      }
    }
    r.farmer = u.id;
    const fx = r.x + Math.sin(u.id) * 0.6, fz = r.z + Math.cos(u.id) * 0.6;
    if (dist2(u.x, u.z, fx, fz) > 0.25) { navToPoint(u, fx, fz, dt, s); return; }
  } else {
    if (edgeDist(u, r) > INTERACT) {
      if (navToEnt(u, r, dt, s) === 'fail') { (u.bad || (u.bad = new Set())).add(r.id); u.gtarget = 0; u.navId = 0; }
      return;
    }
  }
  // gather
  u.path = null; u.navId = 0; u.working = true; faceTo(u, r.x, r.z); u.work += dt;
  const key = r.kind === 'building' ? 'farm' : r.rtype;
  if (key === 'tree' && !r.felled) { r.felled = true; r.fallDir = Math.atan2(r.x - u.x, r.z - u.z) + rand(-0.4, 0.4); View.addFalling(r); Sound.play('fall', r.x, r.z, 0.8); }
  const rate = GATHER_RATE[key] * p.mod.gather[rt] * p.gatherMul * (p.boost || 1) * (p.mod.kind[key] || 1);
  const amt = Math.min(rate * dt, r.amount, cap - u.carry);
  r.amount -= amt; u.carry += amt; u.carryType = rt;
  u.sfxT -= dt;
  if (u.sfxT <= 0) {
    u.sfxT = key === 'farm' ? 1.4 : 0.75;
    const snd = key === 'tree' ? 'chop' : key === 'gold' || key === 'stone' || key === 'treasure' ? 'mine' : key === 'farm' ? 'farm' : null;
    if (snd) Sound.play(snd, u.x, u.z, 0.55);
    if (key === 'tree') PFX.chips(r.x, heightAt(r.x, r.z) + 0.35, r.z, 0xc8a070);
    else if (key === 'gold' || key === 'stone') PFX.chips(r.x, heightAt(r.x, r.z) + 0.3, r.z, key === 'gold' ? 0xf2c537 : 0xb0b0b0);
    else if (key === 'berry') PFX.chips(r.x, heightAt(r.x, r.z) + 0.3, r.z, 0xd8453a);
    else if (key === 'treasure') PFX.spark(r.x, heightAt(r.x, r.z) + 0.4, r.z);
  }
  if (r.kind === 'resource' && (r.rtype === 'gold' || r.rtype === 'stone' || r.rtype === 'berry' || r.rtype === 'treasure' || r.rtype === 'carcass' || (r.rtype === 'tree' && r.fall >= 1))) { r.visT = (r.visT || 0) + dt; if (r.visT > 2) { r.visT = 0; setResInstance(r, true); } }
  if (r.amount <= 0.001) {
    if (r.kind === 'resource' && r.rtype === 'treasure') { p.stats.treasures = (p.stats.treasures || 0) + 1; if (u.owner === HUMAN) UI.notify('Treasure recovered!', 'good', 'tr' + r.id); }
    if (r.kind === 'resource') removeResource(r);
    else { if (r.owner === HUMAN) UI.notify('A farm has been exhausted', '', 'farmx'); destroyBuilding(r, -1, true); }
  }
  if (u.carry >= cap - 0.001) startReturn(u);
}
function updateReturn(u, dt, s) {
  let d = ents.get(u.dropId);
  if (!d || d.dead || !d.built) {
    d = nearestDrop(u.owner, u.carryType, u.x, u.z);
    if (!d) { u.state = 'idle'; return; }
    u.dropId = d.id; u.navId = 0;
  }
  if (edgeDist(u, d) <= INTERACT) {
    const p = players[u.owner];
    if (u.carry > 0 && u.carryType) { p.res[u.carryType] += u.carry; p.stats.gathered[u.carryType] += u.carry; if (u.owner === HUMAN && Game.mode === 'play' && View.visibleToHuman(u.x, u.z)) UI.floatText(u.x, heightAt(u.x, u.z) + 1.3, u.z, '+' + Math.round(u.carry), u.carryType); }
    u.carry = 0; u.path = null; u.navId = 0;
    if (u.gtarget) u.state = 'gather';
    else if (u.gkind) { const nr = findGatherTarget(u, u.gkind, u.gkind === 'hunt' ? 20 : 10); if (nr) { u.gtarget = nr.id; u.state = 'gather'; } else u.state = 'idle'; }
    else u.state = 'idle';
    return;
  }
  if (navToEnt(u, d, dt, s) === 'fail') { u.dropId = 0; u.state = 'idle'; }
}
function findUnfinished(u, radius) {
  let best = null, bd = radius * radius;
  for (const b of buildings) {
    if (b.owner !== u.owner || b.dead || b.built) continue;
    const d = dist2(u.x, u.z, b.x, b.z); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function updateBuild(u, dt, s) {
  const b = ents.get(u.btarget);
  if (!b || b.dead || b.owner !== u.owner) { const nb = findUnfinished(u, 10); if (nb) { u.btarget = nb.id; u.navId = 0; return; } u.state = 'idle'; return; }
  if (b.built && b.hp >= b.maxHp) { onBuildDone(u, b); return; }
  if (edgeDist(u, b) > INTERACT) { if (navToEnt(u, b, dt, s) === 'fail') u.state = 'idle'; return; }
  u.path = null; u.navId = 0; u.working = true; faceTo(u, b.x, b.z); u.work += dt;
  const d = BUILDINGS[b.type];
  if (!b.built) {
    b._bc++;
    const n = Math.max(1, b.builders), f = (1 + 0.65 * (n - 1)) / n;
    const prev = b.progress;
    b.progress = Math.min(1, b.progress + dt / d.time * f * (players[b.owner].boost || 1));
    b.hp = Math.min(b.maxHp, b.hp + (b.progress - prev) * b.maxHp);
    if (b.progress >= 1) completeBuilding(b);
  } else {
    b.hp = Math.min(b.maxHp, b.hp + dt * b.maxHp / (d.time * 2.5) * (b.type === 'wall' || b.type === 'gate' ? 0.5 : 1));
  }
  u.sfxT -= dt; if (u.sfxT <= 0) { u.sfxT = 0.55; Sound.play('hammer', u.x, u.z, 0.5); }
}
function onBuildDone(u, b) {
  u.btarget = 0;
  if (b.type === 'farm') { const f = b.farmer ? ents.get(b.farmer) : null; if (!f || f.dead || f.gtarget !== b.id) { orderGather(u, b); return; } }
  const nb = findUnfinished(u, 12); if (nb) { u.btarget = nb.id; u.navId = 0; return; }
  if (u.resumeG && b.type !== 'lumbercamp' && b.type !== 'miningcamp' && b.type !== 'mill') { const r = ents.get(u.resumeG); u.resumeG = 0; if (r && !r.dead) { orderGather(u, r); return; } }
  u.resumeG = 0;
  const want = { lumbercamp: 'tree', miningcamp: u.lastMine || 'gold', mill: 'berry' }[b.type];
  if (want) { const r = findGatherTarget(u, want, 12); if (r) { orderGather(u, r); return; } }
  if (b.type === 'mill') { const f = findFreeFarm(u, 12); if (f) { orderGather(u, f); return; } }
  u.state = 'idle'; u.home = { x: u.x, z: u.z };
}
function updateGarrisonMove(u, dt, s) {
  const b = ents.get(u.btarget);
  if (!b || b.dead || !b.built || b.owner !== u.owner || !canGarrison(u, b)) { u.state = 'idle'; return; }
  if ((b.garrison.length) >= BUILDINGS[b.type].garrison) { u.state = 'idle'; if (u.owner === HUMAN) UI.notify('Garrison is full', 'warn', 'gfull'); return; }
  if (edgeDist(u, b) <= INTERACT + 0.3) {
    b.garrison.push(u.id); u.garrisonIn = b.id; u.state = 'garrisoned'; u.path = null;
    if (u.owner === HUMAN) Input.deselectEnt(u);
    return;
  }
  if (navToEnt(u, b, dt, s) === 'fail') u.state = 'idle';
}
function canGarrison(u, b) {
  const d = BUILDINGS[b.type]; if (!d.garrison || b.owner !== u.owner) return false;
  if (b.type === 'towncenter') return u.type === 'villager';
  const c = UNITS[u.type].cls; return c === 'villager' || c === 'infantry' || c === 'archer';
}
function ungarrison(b) {
  const out = b.garrison.slice(); b.garrison.length = 0;
  let k = 0;
  for (const id of out) {
    const u = ents.get(id); if (!u || u.dead) continue;
    const a = k++ * 0.7 + (b.owner === 1 ? Math.PI : 0);
    const px = b.x + Math.sin(a) * (b.size / 2 + 0.8), pz = b.z + Math.cos(a) * (b.size / 2 + 0.8);
    const nf = nearestFree(px, pz, u.owner, 8) || { x: px, z: pz };
    u.x = nf.x; u.z = nf.z; u.garrisonIn = 0; u.state = 'idle'; u.home = { x: u.x, z: u.z };
    if (u.prev) { const pv = u.prev; u.prev = null; const t = ents.get(pv.id); if (t && !t.dead) { if (pv.state === 'gather') orderGather(u, t); else if (pv.state === 'build') orderBuild(u, t); } }
    else if (b.rally) orderMove(u, b.rally.x + rand(-0.5, 0.5), b.rally.z + rand(-0.5, 0.5));
  }
}

// ---------------- buildings ----------------
function footprintTiles(tx, ty, s, fn) { for (let y = ty; y < ty + s; y++) for (let x = tx; x < tx + s; x++) fn(x, y, idx(x, y)); }
function canPlace(type, tx, ty, owner, ignoreFog) {
  const d = BUILDINGS[type]; const s = d.size;
  if (tx < 1 || ty < 1 || tx + s > N - 1 || ty + s > N - 1) return false;
  let ok = true, hmin = 1e9, hmax = -1e9;
  const p = players[owner];
  footprintTiles(tx, ty, s, (x, y, i) => {
    if (!ok) return;
    if (World.ter[i] === T_WATER) { ok = false; return; }
    const o = World.occ[i];
    if (type === 'gate' && o) { const w = ents.get(o); if (w && w.kind === 'building' && w.type === 'wall' && w.owner === owner) return; }
    if (o || World.pass[i] !== 0) { ok = false; return; }
    if (owner === HUMAN && !ignoreFog && !p.exp[i]) { ok = false; return; }
    const h = World.th[i]; if (h < hmin) hmin = h; if (h > hmax) hmax = h;
  });
  if (!ok) return false;
  if (hmax - hmin > 1.2) return false;
  if (!d.walk) {
    let blocked = false;
    forUnitsNear(tx + s / 2, ty + s / 2, s, u => { if (!u.dead && isEnemy(owner, u.owner) && u.x >= tx && u.x <= tx + s && u.z >= ty && u.z <= ty + s) blocked = true; });
    if (blocked) return false;
  }
  return true;
}
// returns building or an error string
function placeBuilding(owner, type, tx, ty, builders, free) {
  const p = players[owner], d = BUILDINGS[type];
  if (!realmOk(d, p)) return 'Only the ' + FACTIONS[d.realm].name + ' can build this';
  if (d.limit && buildings.filter(b => b.owner === owner && b.type === type && !b.dead).length >= d.limit) return 'Limit reached: ' + d.limit + ' ' + d.name + (d.limit > 1 ? 's' : '');
  if (p.age < d.age) return 'Requires ' + AGE_NAMES[d.age];
  if (d.needs && !buildings.some(b => b.owner === owner && b.type === d.needs && b.built && !b.dead)) return 'Requires a ' + BUILDINGS[d.needs].name;
  if (type === 'wonder' && buildings.some(b => b.owner === owner && b.type === 'wonder' && !b.dead)) return 'Only one Wonder allowed';
  if (!free && !canAfford(p, d.cost)) return 'Not enough ' + missingRes(p, d.cost);
  if (!canPlace(type, tx, ty, owner)) return 'Cannot build there';
  if (type === 'gate') footprintTiles(tx, ty, 1, (x, y, i) => { const w = ents.get(World.occ[i]); if (w && w.type === 'wall') destroyBuilding(w, -1, true, true); });
  if (!free) pay(p, d.cost);
  const b = createBuilding(type, owner, tx, ty, false);
  if (builders) for (const u of builders) orderBuild(u, b);
  return b;
}
function createBuilding(type, owner, tx, ty, built) {
  const d = BUILDINGS[type], s = d.size, p = players[owner];
  const b = { id: nextId++, kind: 'building', type, owner, tx, ty, size: s, x: tx + s / 2, z: ty + s / 2, y: 0, hp: built ? d.hp : 1, maxHp: d.hp, built: false, progress: built ? 1 : 0,
    queue: [], rally: null, garrison: [], cool: 0, dead: false, dieT: 0, builders: 0, _bc: 0, age: p.age, fireT: 0, amount: 0, farmer: 0, smokeT: Math.random() * 3, level: 1, variant: Math.floor(Math.random() * 3) };
  b.maxHp = Math.round(d.hp * (p.mod.bldHp || 1)); if (built) b.hp = b.maxHp;
  let hs = 0, hn = 0;
  for (let y = ty; y <= ty + s; y++) for (let x = tx; x <= tx + s; x++) { hs += World.vh[y * (N + 1) + x]; hn++; }
  b.y = hs / hn;
  footprintTiles(tx, ty, s, (x, y, i) => { World.occ[i] = b.id; if (!d.walk) { World.pass[i] = d.gate ? 2 : 1; if (d.gate) World.gate[i] = owner; } });
  ents.set(b.id, b); buildings.push(b);
  hideDecoration(tx, ty, s);
  View.createBuildingMesh(b);
  if (built) completeBuilding(b, true);
  if (!d.walk) for (const u of units) if (!u.dead && !u.garrisonIn && u.x >= tx && u.x <= tx + s && u.z >= ty && u.z <= ty + s) { const nf = nearestFree(u.x, u.z, u.owner, 8); if (nf) { u.x = nf.x; u.z = nf.z; u.path = null; } }
  Minimap.dirty = true;
  return b;
}
function completeBuilding(b, silent) {
  const d = BUILDINGS[b.type];
  b.built = true; b.progress = 1;
  if (b.type === 'farm') b.amount = d.food + players[b.owner].mod.farmFood;
  View.onBuildingComplete(b);
  if (!silent && b.owner === HUMAN && Game.mode === 'play') { Sound.play('done'); if (b.type !== 'wall' && b.type !== 'farm') UI.notify(d.name + ' completed', 'good', 'done' + b.type, { x: b.x, z: b.z }); }
  if (b.type === 'wonder') {
    b.wonderT = WONDER_TIME;
    if (Game.mode === 'play') { UI.notify(players[b.owner].name + ' completed a Wonder! 5 minutes until victory.', b.owner === HUMAN ? 'good' : 'warn'); Sound.play('fanfare'); }
  }
}
function destroyBuilding(b, killerOwner, silent, noStats) {
  if (b.dead) return;
  b.dead = true; b.dieT = 0; b.hp = 0;
  const d = BUILDINGS[b.type];
  footprintTiles(b.tx, b.ty, b.size, (x, y, i) => { if (World.occ[i] === b.id) { World.occ[i] = 0; World.pass[i] = 0; World.gate[i] = -1; } });
  if (b.garrison.length) ungarrison(b);
  const p = players[b.owner];
  for (const it of b.queue) if (it.kind === 'tech') p.researching.delete(it.id);
  b.queue.length = 0;
  if (!noStats && b.owner <= 1 && b.type !== 'farm') { p.stats.bldLost++; if (killerOwner >= 0 && killerOwner <= 1 && killerOwner !== b.owner) players[killerOwner].stats.bldDestroyed++; }
  if (!silent) { Sound.play('collapse', b.x, b.z, 1); PFX.dust(b.x, b.y + 0.4, b.z, 18, b.size * 0.5); }
  View.onBuildingDestroyed(b, silent);
  Minimap.dirty = true;
}
function eligibleQualify(owner, age) {
  const set = new Set();
  for (const b of buildings) if (b.owner === owner && b.built && !b.dead && AGE_QUAL[age] && AGE_QUAL[age].includes(b.type)) set.add(b.type);
  return set.size;
}
// can a player queue this? returns null if ok, else a reason string
function trainBlock(b, utype) {
  const p = players[b.owner], d = UNITS[utype];
  if (!b.built) return 'Building not finished';
  if (!realmOk(d, p)) return 'Not available to your realm';
  if (p.age < d.age) return 'Requires ' + AGE_NAMES[d.age];
  if (b.queue.length >= 5) return 'Queue is full';
  if (!canAfford(p, d.cost)) return 'Not enough ' + missingRes(p, d.cost);
  return null;
}
function techBlock(b, tk) {
  const p = players[b.owner], t = TECHS[tk];
  if (!b.built) return 'Building not finished';
  if (p.techs.has(tk)) return 'Already researched';
  if (p.researching.has(tk)) return 'Already researching';
  if (t.ageUp) {
    if (p.age !== t.age) return p.age > t.age ? 'Already advanced' : 'Requires ' + AGE_NAMES[t.age];
    if (b.queue.some(q => q.kind === 'tech' && TECHS[q.id].ageUp)) return 'Already researching';
    if (buildings.some(o => o.owner === b.owner && !o.dead && o.queue.some(q => q.kind === 'tech' && TECHS[q.id].ageUp))) return 'Already advancing';
    if (eligibleQualify(b.owner, p.age) < 2) return 'Requires 2 different ' + AGE_NAMES[p.age] + ' buildings';
  } else if (p.age < t.age) return 'Requires ' + AGE_NAMES[t.age];
  if (t.req && !p.techs.has(t.req)) return 'Requires ' + TECHS[t.req].name;
  if (b.queue.length >= 5) return 'Queue is full';
  if (!canAfford(p, t.cost)) return 'Not enough ' + missingRes(p, t.cost);
  return null;
}
// building upgrades: level 2 needs Feudal, level 3 needs Iron
const NO_UPGRADE = ['wall', 'gate', 'farm', 'wonder'];
function upgradeCost(b) { const d = BUILDINGS[b.type], L = b.level || 1; return { wood: Math.round((d.cost.wood || 120) * 0.4 * L) + 40, stone: 40 * L + Math.round((d.cost.stone || 0) * 0.25) }; }
function upgradeBlock(b) {
  const p = players[b.owner], L = b.level || 1;
  if (NO_UPGRADE.includes(b.type)) return 'Cannot be upgraded';
  if (!b.built) return 'Building not finished';
  if (L >= 3) return 'Fully upgraded';
  if (p.age < L) return 'Requires ' + AGE_NAMES[L];
  if (b.queue.some(q => q.kind === 'upgrade')) return 'Already upgrading';
  if (b.queue.length >= 5) return 'Queue is full';
  const c = upgradeCost(b); if (!canAfford(p, c)) return 'Not enough ' + missingRes(p, c);
  return null;
}
function queueUpgrade(b) {
  const err = upgradeBlock(b); if (err) return err;
  const c = upgradeCost(b); pay(players[b.owner], c);
  b.queue.push({ kind: 'upgrade', id: 'upgrade', t: 0, total: 20 + 15 * (b.level || 1), cost: c });
  return null;
}
function finishUpgrade(b) {
  b.level = (b.level || 1) + 1;
  const inc = Math.round(BUILDINGS[b.type].hp * 0.25); b.maxHp += inc; b.hp += inc;
  if (b.inner) b.inner.scale.setScalar(1 + 0.05 * (b.level - 1));
  if (b.owner === HUMAN && Game.mode === 'play') { UI.notify(BUILDINGS[b.type].name + ' upgraded to level ' + b.level, 'good', 'up' + b.id); Sound.play('done'); }
  PFX.spark(b.x, b.y + 1.5, b.z);
}
function queueTrain(b, utype) {
  const err = trainBlock(b, utype); if (err) return err;
  const d = UNITS[utype]; pay(players[b.owner], d.cost);
  b.queue.push({ kind: 'unit', id: utype, t: 0, total: d.time, cost: d.cost, started: false });
  return null;
}
function queueTech(b, tk) {
  const err = techBlock(b, tk); if (err) return err;
  const t = TECHS[tk], p = players[b.owner]; pay(p, t.cost); p.researching.add(tk);
  b.queue.push({ kind: 'tech', id: tk, t: 0, total: t.time, cost: t.cost });
  return null;
}
function cancelQueue(b, i) {
  const it = b.queue[i]; if (!it) return;
  const p = players[b.owner]; refund(p, it.cost);
  if (it.kind === 'tech') p.researching.delete(it.id);
  b.queue.splice(i, 1);
}
function finishTech(b, tk) {
  const p = players[b.owner], t = TECHS[tk];
  p.researching.delete(tk); p.techs.add(tk);
  if (t.ageUp) {
    p.age = t.ageUp;
    View.ageUpBuildings(b.owner);
    if (Game.mode === 'play') {
      if (b.owner === HUMAN) { UI.notify('You have advanced to the ' + AGE_NAMES[p.age] + '!', 'good'); Sound.play('fanfare'); }
      else UI.notify(p.name + ' has advanced to the ' + AGE_NAMES[p.age], '', 'aiage');
    }
  } else {
    const oldV = ustat(b.owner, 'villager').hp;
    t.apply(p); p.ver++;
    const nv = ustat(b.owner, 'villager').hp;
    if (nv !== oldV) for (const u of units) if (u.owner === b.owner && u.type === 'villager' && !u.dead) { u.maxHp = nv; u.hp += nv - oldV; }
    if (b.owner === HUMAN && Game.mode === 'play') { UI.notify(t.name + ' researched', 'good', 'tech'); Sound.play('done'); }
  }
}
function exitPoint(b, toward) {
  let ax = 0, az = 1;
  if (toward) { const dx = toward.x - b.x, dz = toward.z - b.z, l = Math.sqrt(dx * dx + dz * dz); if (l > 0.1) { ax = dx / l; az = dz / l; } }
  else if (b.owner === 1) az = -1;
  const r = b.size / 2 + 0.6;
  return nearestFree(b.x + ax * r, b.z + az * r, b.owner, 10) || { x: b.x + ax * r, z: b.z + az * r };
}
function finishUnit(b, utype) {
  const p = players[b.owner];
  const ep = exitPoint(b, b.rally);
  const u = spawnUnit(utype, b.owner, ep.x, ep.z);
  p.stats.trained++;
  if (b.rally) {
    const t = b.rally.id ? ents.get(b.rally.id) : null;
    if (t && !t.dead && utype === 'villager' && (t.kind === 'resource' || (t.kind === 'building' && t.type === 'farm'))) orderGather(u, t);
    else if (t && !t.dead && utype === 'villager' && t.kind === 'building' && !t.built && t.owner === b.owner) orderBuild(u, t);
    else orderMove(u, b.rally.x, b.rally.z);
  }
  if (b.owner === HUMAN && Game.mode === 'play') Sound.play('train', b.x, b.z, 0.7);
  return u;
}
function updateBuilding(b, dt) {
  if (b.dead) { b.dieT += dt; return; }
  const d = BUILDINGS[b.type], p = players[b.owner];
  // fire / smoke
  if (b.built || b.progress > 0.3) {
    if (b.hp < (b.built ? b.maxHp : b.maxHp * b.progress) * 0.5 && b.type !== 'farm') { b.fireT -= dt; if (b.fireT <= 0) { b.fireT = b.hp < b.maxHp * 0.25 ? 0.05 : 0.1; if (Game.mode !== 'play' || players[HUMAN].vis[idx(b.x | 0, b.z | 0)]) { PFX.fire(b.x + rand(-0.3, 0.3) * b.size, b.y + 0.6 + Math.random() * 0.8, b.z + rand(-0.3, 0.3) * b.size, b.size >= 3 ? 1.3 : 0.9); } } }
    if (b.built && (b.type === 'towncenter' || b.type === 'house' || b.type === 'blacksmith')) { b.smokeT -= dt; if (b.smokeT <= 0) { b.smokeT = b.type === 'blacksmith' ? 0.35 : 0.9; const o = b.type === 'blacksmith' ? [0.75, -0.65] : b.type === 'house' ? [-0.38, -0.25] : [0, 0]; const sgn = b.owner === 1 ? -1 : 1; PFX.smoke(b.x + o[0] * sgn, b.y + (b.type === 'towncenter' ? 3.2 : 1.9), b.z + o[1] * sgn); } }
  }
  if (!b.built) return;
  if (d.income) for (const r in d.income) { const a = d.income[r] * dt; p.res[r] += a; p.stats.gathered[r] += a; }
  if (b.type === 'wonder' && b.wonderT !== undefined) b.wonderT -= dt;
  // production
  const it = b.queue[0];
  if (it) {
    let go = true;
    if (it.kind === 'unit' && !it.started) {
      if (p.pop >= p.popCap) {
        go = false;
        if (b.owner === HUMAN && Game.mode === 'play') UI.notify(p.popCap >= POP_MAX ? 'Population limit reached (100)' : 'Population limit reached — build Houses', 'warn', 'pop');
      } else { it.started = true; p.pop++; }
    }
    if (go) {
      it.t += dt * (1 + 0.2 * ((b.level || 1) - 1)) * (p.boost || 1);
      if (it.t >= it.total) {
        b.queue.shift();
        if (it.kind === 'unit') finishUnit(b, it.id); else if (it.kind === 'upgrade') finishUpgrade(b); else finishTech(b, it.id);
      }
    }
  }
  // arrows
  if (d.attack) {
    b.cool -= dt;
    if (b.cool <= 0) {
      const st = bstat(b.owner, b.type), L = (b.level || 1) - 1, range = st.range + b.size / 2 + L * 0.5;
      let best = null, bd = range * range;
      forUnitsNear(b.x, b.z, range, o => {
        if (o.dead || !isEnemy(b.owner, o.owner)) return;
        const dd = dist2(b.x, b.z, o.x, o.z); if (dd < bd) { bd = dd; best = o; }
      });
      if (best) {
        let n = st.arrows + L;
        for (const gid of b.garrison) { const g = ents.get(gid); if (g && (g.type === 'villager' || UNITS[g.type].cls === 'archer' || UNITS[g.type].cls === 'infantry')) n++; }
        n = Math.min(n, 12);
        const ty = bldTopY(b);
        for (let k = 0; k < n; k++) spawnProjectile('arrow', b.owner, b.x + rand(-0.4, 0.4), ty, b.z + rand(-0.4, 0.4), best, st, k * 0.08, b.id);
        Sound.play('arrow', b.x, b.z, 0.7);
        b.cool = st.reload;
      } else b.cool = 0.5;
    }
  }
}

// ---------------- projectiles ----------------
function spawnProjectile(kind, owner, x, y, z, target, stat, delay, srcId) {
  const tx = target.x, tz = target.z;
  const ty = target.kind === 'unit' ? heightAt(tx, tz) + 0.4 : target.y + 0.6;
  const d = Math.sqrt(dist2(x, z, tx, tz));
  const speed = kind === 'stone' ? 8 : kind === 'spear' ? 11 : 15;
  let tgtX = tx, tgtZ = tz;
  if (kind === 'stone' && target.kind === 'unit') { tgtX += rand(-0.5, 0.5); tgtZ += rand(-0.5, 0.5); }
  projectiles.push({ kind, owner, sx: x, sy: y, sz: z, tx: tgtX, ty, tz: tgtZ, tid: target.id, t: -(delay || 0), dur: Math.max(0.15, d / speed), arc: kind === 'stone' ? d * 0.35 : d * 0.09, stat, src: srcId, homing: kind !== 'stone' });
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.t += dt;
    if (pr.t < 0) continue;
    if (pr.homing) {
      const t = ents.get(pr.tid);
      if (t && !t.dead && !t.garrisonIn) { pr.tx = t.x; pr.tz = t.z; pr.ty = t.kind === 'unit' ? heightAt(t.x, t.z) + 0.4 : t.y + 0.6; }
    }
    if (pr.t >= pr.dur) {
      projectiles.splice(i, 1);
      const src = ents.get(pr.src);
      if (pr.kind === 'stone') {
        const r = pr.stat.splash || 1.3;
        forUnitsNear(pr.tx, pr.tz, r + 0.5, o => {
          if (o.dead || !isEnemy(pr.owner, o.owner)) return;
          const dd = Math.sqrt(dist2(o.x, o.z, pr.tx, pr.tz));
          if (dd <= r + UNITS[o.type].radius) applyDamage(o, Math.max(1, calcDamage(pr.stat, o) * (dd < r * 0.5 ? 1 : 0.6)), src && !src.dead ? src : null, pr.owner);
        });
        for (const b of buildings) { if (b.dead || !isEnemy(pr.owner, b.owner)) continue; if (rectDist(pr.tx, pr.tz, b) <= r * 0.5) applyDamage(b, calcDamage(pr.stat, b), src && !src.dead ? src : null, pr.owner); }
        Sound.play('stone', pr.tx, pr.tz, 0.9);
        PFX.dust(pr.tx, heightAt(pr.tx, pr.tz) + 0.2, pr.tz, 10, 0.6);
        Sound.battle(0.1);
      } else {
        const t = ents.get(pr.tid);
        if (t && !t.dead && !t.garrisonIn && (t.kind !== 'unit' || dist2(t.x, t.z, pr.tx, pr.tz) < 1)) applyDamage(t, calcDamage(pr.stat, t), src && !src.dead ? src : null, pr.owner);
      }
    }
  }
}

// ---------------- separation (units avoid each other) ----------------
function separation(dt) {
  const k = Math.min(1, dt * 8);
  for (const u of units) {
    if (u.dead || u.garrisonIn) continue;
    const ru = UNITS[u.type].radius;
    forUnitsNear(u.x, u.z, 1.2, o => {
      if (o.id <= u.id || o.dead || o.garrisonIn) return;
      const ro = UNITS[o.type].radius, rr = (ru + ro) * 0.92;
      let dx = u.x - o.x, dz = u.z - o.z; let d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) return;
      if (d2 < 1e-6) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d2 = dx * dx + dz * dz; }
      const d = Math.sqrt(d2), push = (rr - d) * k;
      const nx = dx / d, nz = dz / d;
      let wu = 0.5;
      const um = u.moving, om = o.moving;
      if (um && !om) wu = 0.25; else if (!um && om) wu = 0.75;
      if (u.working && !o.working) wu = 0.15; else if (o.working && !u.working) wu = 0.85;
      if (u.type === 'ram' || u.type === 'catapult') wu *= 0.3; if (o.type === 'ram' || o.type === 'catapult') wu = 1 - (1 - wu) * 0.3;
      const ux = u.x + nx * push * wu, uz = u.z + nz * push * wu;
      if (posFree(ux, uz, u.owner)) { u.x = ux; u.z = uz; }
      const ox = o.x - nx * push * (1 - wu), oz = o.z - nz * push * (1 - wu);
      if (posFree(ox, oz, o.owner)) { o.x = ox; o.z = oz; }
    });
  }
}

// ---------------- formations ----------------
function formationMove(list, x, z, attackMove) {
  const us = list.filter(u => u.kind === 'unit' && !u.dead);
  if (!us.length) return;
  if (us.length === 1) { attackMove ? orderAttackMove(us[0], x, z) : orderMove(us[0], x, z); return; }
  let cx = 0, cz = 0; for (const u of us) { cx += u.x; cz += u.z; } cx /= us.length; cz /= us.length;
  let dx = x - cx, dz = z - cz; const l = Math.sqrt(dx * dx + dz * dz) || 1; dx /= l; dz /= l;
  const rx = dz, rz = -dx;
  const rank = u => { const c = UNITS[u.type].cls; return c === 'cavalry' ? 0 : c === 'infantry' ? 1 : c === 'archer' ? 2 : c === 'villager' ? 3 : 4; };
  us.sort((a, b) => rank(a) - rank(b) || (a.x * rx + a.z * rz) - (b.x * rx + b.z * rz));
  const cols = Math.max(2, Math.ceil(Math.sqrt(us.length * 1.6)));
  const sp = 0.85;
  const allMil = us.every(isMil);
  let slow = Infinity; for (const u of us) slow = Math.min(slow, ustat(u.owner, u.type).speed);
  const rows = Math.ceil(us.length / cols);
  us.forEach((u, i) => {
    const r = (i / cols) | 0, c = i % cols;
    const inRow = r === rows - 1 ? us.length - r * cols : cols;
    const lat = (c - (inRow - 1) / 2) * sp, dep = -(r - (rows - 1) / 2) * sp;
    let px = x + rx * lat + dx * dep, pz = z + rz * lat + dz * dep;
    px = clamp(px, 0.5, N - 0.5); pz = clamp(pz, 0.5, N - 0.5);
    if (attackMove) orderAttackMove(u, px, pz);
    else orderMove(u, px, pz, allMil && l < 40 ? slow : 0);
  });
}
