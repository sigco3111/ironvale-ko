// =====================================================================
//  AI — plays by the same rules as the human (Hard gets a small bonus)
// =====================================================================
const AIs = [];
// no hostile wild guards left near (x,z)?
function campSafe(x, z) { let safe = true; forUnitsNear(x, z, 7, o => { if (safe && !o.dead && o.owner === GAIA && UNITS[o.type].hostile && dist2(o.x, o.z, x, z) < 49) safe = false; }); return safe; }
const AI_CFG = {
  easy: { think: 2.2, vils: 17, firstAttack: 13 * 60, wave: 5, grow: 3, maxArmy: 18, techs: 0.3, milB: { 1: ['barracks', 'range'], 2: ['workshop'] }, house: 2 },
  standard: { think: 1.0, vils: 27, firstAttack: 7.4 * 60, wave: 6, grow: 4, maxArmy: 40, techs: 0.8, milB: { 1: ['barracks', 'range', 'blacksmith', 'stable'], 2: ['workshop', 'range'] }, house: 3 },
  hard: { think: 0.5, vils: 33, firstAttack: 6.8 * 60, wave: 7, grow: 5, maxArmy: 60, techs: 1, counter: true, milB: { 1: ['barracks', 'range', 'blacksmith', 'stable', 'barracks'], 2: ['workshop', 'range', 'stable', 'castle'] }, house: 4 },
};
class AIPlayer {
  constructor(pid, diff) {
    this.pid = pid; this.diff = diff; this.cfg = AI_CFG[diff]; this.p = players[pid];
    this.enemy = pid === 0 ? 1 : 0;
    this.home = World.starts[pid]; this.enemyStart = World.starts[this.enemy];
    this.t = Math.random() * 0.5; this.known = new Map(); this.seenUnits = {};
    this.attackT = this.cfg.firstAttack; this.wave = 0; this.attacking = false; this.attackSince = 0;
    this.lastHit = null; this.garrisoned = false; this.calmT = 0; this.scoutPts = null; this.scoutId = 0; this.rebalanceT = 10;
    const dx = N / 2 - this.home.x, dz = N / 2 - this.home.y, l = Math.hypot(dx, dz);
    this.dir = { x: dx / l, z: dz / l };
    this.stage = { x: this.home.x + this.dir.x * 9, z: this.home.y + this.dir.z * 9 };
    if (diff === 'hard') { this.p.gatherMul = 1.12; for (const r of RESN) this.p.res[r] += 100; }
  }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.cfg.think * (0.85 + Math.random() * 0.3);
    try { this.think(); } catch (err) { console.error('AI error', err); }
  }
  onAttacked(t, attacker) {
    this.lastHit = { x: attacker ? attacker.x : t.x, z: attacker ? attacker.z : t.z, time: Game.time, mil: attacker && attacker.kind === 'unit' && isMil(attacker) };
    if (this.t > 0.3) this.t = 0.3;
  }
  // ------------------------------------------------------------------
  think() {
    const pid = this.pid, p = this.p;
    const my = units.filter(u => u.owner === pid && !u.dead);
    const vils = my.filter(u => u.type === 'villager');
    const army = my.filter(u => isMil(u) && u.id !== this.scoutId);
    const blds = buildings.filter(b => b.owner === pid && !b.dead);
    this.blds = blds; this.vils = vils; this.army = army;
    const tc = blds.find(b => b.type === 'towncenter' && b.built) || blds.find(b => b.type === 'towncenter');
    this.tc = tc;
    const cx = tc ? tc.x : this.home.x, cz = tc ? tc.z : this.home.y;
    this.cx = cx; this.cz = cz;
    this.updateKnowledge();
    // reserve resources for the next age
    this.reserve = {};
    const ageT = p.age === 0 ? 'feudal' : p.age === 1 ? 'iron' : null;
    if (ageT && tc && eligibleQualify(pid, p.age) >= 2 && !p.researching.has(ageT) && vils.length >= (p.age === 0 ? 11 : 19)) this.reserve = TECHS[ageT].cost;
    this.defend(cx, cz);
    this.economy(tc, cx, cz);
    this.construct(tc, cx, cz);
    this.produce();
    this.research(tc);
    this.scouting();
    this.offense();
  }
  afford(cost, strict) { const p = this.p, h = strict && this.hold && this.hold !== cost ? this.hold : null; for (const r in cost) if (Math.floor(p.res[r]) - (this.reserve[r] || 0) - (h ? h[r] || 0 : 0) < cost[r]) return false; return true; }
  updateKnowledge() {
    const vis = this.p.vis;
    for (const b of buildings) if (b.owner === this.enemy && !b.dead && vis[idx(b.x | 0, b.z | 0)]) this.known.set(b.id, b);
    // a realm without a Town Center can no longer hide its remnants
    if (!buildings.some(b => b.owner === this.enemy && b.type === 'towncenter' && !b.dead)) for (const b of buildings) if (b.owner === this.enemy && !b.dead) this.known.set(b.id, b);
    for (const [id, b] of this.known) if (b.dead) this.known.delete(id);
    const seen = { infantry: 0, archer: 0, cavalry: 0, siege: 0 };
    for (const u of units) if (u.owner === this.enemy && !u.dead && vis[idx(u.x | 0, u.z | 0)] && seen[UNITS[u.type].cls] !== undefined) seen[UNITS[u.type].cls]++;
    for (const k in seen) this.seenUnits[k] = Math.max(seen[k], (this.seenUnits[k] || 0) * 0.9);
  }
  // ------------------------------------------------------------------
  defend(cx, cz) {
    const pid = this.pid;
    let tx = 0, tz = 0, n = 0, str = 0;
    const scan = (x, z, r) => forUnitsNear(x, z, r, o => { if (!o.dead && o.owner === this.enemy && !o._ai) { o._ai = 1; tx += o.x; tz += o.z; n++; str += ustat(o.owner, o.type).atk * (o.hp / 10 + 1); } });
    scan(cx, cz, 17);
    for (const b of this.blds) if (b.type !== 'wall' && b.type !== 'farm' && Math.abs(b.x - cx) + Math.abs(b.z - cz) > 10) scan(b.x, b.z, 7);
    for (const u of units) u._ai = 0;
    let nTC = 0; forUnitsNear(cx, cz, 14, o => { if (!o.dead && o.owner === this.enemy && isMil(o)) nTC++; });
    if (nTC > 0) this.tcCalm = 0; else this.tcCalm = (this.tcCalm || 0) + this.cfg.think;
    if (this.garrisoned && this.tcCalm > 5 && this.tc) { ungarrison(this.tc); this.garrisoned = false; }
    if (this.lastHit && Game.time - this.lastHit.time < 4 && n === 0 && dist2(this.lastHit.x, this.lastHit.z, cx, cz) < 30 * 30) { tx = this.lastHit.x; tz = this.lastHit.z; n = 1; str = 5; }
    if (n > 0) {
      tx /= n; tz /= n; this.calmT = 0;
      // defenders: units not on a far-away offensive
      const home = this.army.filter(u => dist2(u.x, u.z, cx, cz) < 30 * 30 || (this.cfg.counter && str > 60));
      let myStr = 0; for (const u of home) myStr += ustat(u.owner, u.type).atk * (u.hp / 10 + 1);
      for (const u of home) if (u.state === 'idle' || (u.state === 'amove' && dist2(u.amove.x, u.amove.z, tx, tz) > 36) || u.state === 'move') { if (u.type !== 'ram') orderAttackMove(u, tx + rand(-1, 1), tz + rand(-1, 1)); }
      // pull villagers to safety
      const tc = this.tc;
      if (tc && tc.built && nTC > 0 && this.lastHit && this.lastHit.mil && str > myStr * 0.7 && str > 12) {
        let cap = BUILDINGS.towncenter.garrison - tc.garrison.length;
        const near = this.vils.filter(u => !u.garrisonIn && u.state !== 'garrison' && dist2(u.x, u.z, tx, tz) < 12 * 12 && dist2(u.x, u.z, tc.x, tc.z) < 22 * 22)
          .sort((a, b) => dist2(a.x, a.z, tc.x, tc.z) - dist2(b.x, b.z, tc.x, tc.z));
        for (const u of near) {
          if (cap-- <= 0) break;
          u.prev = { state: u.state === 'return' ? 'gather' : u.state, id: u.gtarget || u.btarget };
          orderGarrison(u, tc); this.garrisoned = true;
        }
      }
      // last resort: villagers fight a lone raider when no army
      if (home.length === 0 && n <= 2 && str < 30) {
        const fighters = this.vils.filter(u => !u.garrisonIn && dist2(u.x, u.z, tx, tz) < 8 * 8).slice(0, 4);
        let target = null; forUnitsNear(tx, tz, 6, o => { if (!target && !o.dead && o.owner === this.enemy) target = o; });
        if (target) for (const u of fighters) if (u.state !== 'attack') { u.prev = { state: u.state === 'return' ? 'gather' : u.state, id: u.gtarget || u.btarget }; orderAttack(u, target); }
      }
    } else {
      this.calmT += this.cfg.think;
      if (this.garrisoned && this.calmT > 6 && this.tc) { ungarrison(this.tc); this.garrisoned = false; }
      // villagers that fought go back to work
      for (const u of this.vils) if (u.prev && (u.state === 'idle' || u.state === 'attack' && !ents.get(u.target))) { const pv = u.prev; u.prev = null; const t = ents.get(pv.id); if (t && !t.dead) { if (pv.state === 'gather') orderGather(u, t); else if (pv.state === 'build') orderBuild(u, t); } }
    }
  }
  // ------------------------------------------------------------------
  economy(tc, cx, cz) {
    const p = this.p, vils = this.vils;
    // train villagers
    if (tc && tc.built && vils.length + tc.queue.filter(q => q.id === 'villager').length < this.cfg.vils && tc.queue.length < 2 && p.pop < p.popCap) {
      if (this.afford(UNITS.villager.cost) || ((!this.reserve.food || (p.age >= 1 && vils.length < 24)) && canAfford(p, UNITS.villager.cost))) queueTrain(tc, 'villager');
    }
    // gatherer counts
    const cnt = { food: 0, wood: 0, gold: 0, stone: 0 };
    const assigned = new Map();
    for (const u of vils) {
      if ((u.state === 'gather' || u.state === 'return') && u.gres) { cnt[u.gres]++; if (u.gtarget) assigned.set(u.gtarget, (assigned.get(u.gtarget) || 0) + 1); }
    }
    this.assigned = assigned; this.cnt = cnt;
    const total = vils.length;
    const want = p.age === 0 ? (total < 12 ? { food: 0.6, wood: 0.4, gold: 0, stone: 0 } : { food: 0.52, wood: 0.34, gold: 0.1, stone: 0.04 })
      : p.age === 1 ? { food: 0.5, wood: 0.3, gold: 0.17, stone: 0.03 } : { food: 0.45, wood: 0.25, gold: 0.24, stone: 0.06 };
    if (p.res.stone > 350 && !this.wantStone) { want.food += want.stone; want.stone = 0; }
    if (p.res.gold > 700) { want.food += want.gold * 0.6; want.gold *= 0.4; }
    if (p.res.wood > 600) { const k = p.res.wood > 1500 ? 0.8 : 0.55; want.food += want.wood * k * 0.6; want.gold += want.wood * k * 0.4; want.wood *= 1 - k; }
    if (this.reserve.food && p.res.food < this.reserve.food) { want.food += 0.08; want.wood -= 0.08; }
    if (this.wantStone) { want.stone += 0.1; want.food -= 0.05; want.wood -= 0.05; }
    const deficit = r => want[r] * total - cnt[r];
    for (const u of vils) {
      if (u.garrisonIn || u.state !== 'idle') continue;
      const order = RESN.slice().sort((a, b) => deficit(b) - deficit(a));
      for (const r of order) { if (this.assignGather(u, r)) { cnt[r]++; break; } }
    }
    // gentle rebalancing
    this.rebalanceT -= this.cfg.think;
    if (this.rebalanceT <= 0 && total > 8) {
      this.rebalanceT = 6;
      const order = RESN.slice().sort((a, b) => deficit(b) - deficit(a));
      const need = order[0], surplus = order[order.length - 1];
      if (deficit(need) > 0.9 && deficit(surplus) < -0.9) {
        const u = vils.find(v => v.state === 'gather' && v.gres === surplus && v.carry < 3);
        if (u) this.assignGather(u, need);
      }
    }
  }
  assignGather(u, res) {
    const cx = this.cx, cz = this.cz, asg = this.assigned;
    let best = null, bd = Infinity;
    const consider = (r, d, maxPer) => { if ((asg.get(r.id) || 0) >= maxPer) return; if (d < bd) { bd = d; best = r; } };
    if (res === 'food') {
      for (const r of resources) {
        if (r.dead || r.amount <= 0) continue;
        if (r.rtype === 'berry' || r.rtype === 'carcass') { const d = Math.sqrt(dist2(r.x, r.z, cx, cz)); if (d < 26 || (r.rtype === 'carcass' && d < 45 && this.p.exp[idx(r.x | 0, r.z | 0)])) consider(r, d + (r.rtype === 'carcass' ? -6 : 0), r.rtype === 'carcass' ? 3 : 2); }
      }
      // livestock grazing by the town first (no chasing), then wild game; bulls only with a big food crew
      if (!best) forUnitsNear(cx, cz, 22, o => { if (!isAnimal(o) || o.dead) return; const ad = UNITS[o.type]; if (ad.cls !== 'animal' || !ad.food || ad.hostile || ad.boss) return; const dd = Math.sqrt(dist2(o.x, o.z, cx, cz)); if (ad.livestock) consider(o, dd - 6, 3); else if (ad.aggressive) { if ((this.cnt && this.cnt.food || 0) >= 6) consider(o, dd + 10, 4); } else consider(o, dd + 4, 3); });
      if (!best) { const f = findFreeFarm(u, 40); if (f && !(asg.get(f.id))) best = f; }
      if (!best) {
        // build a farm
        const mill = this.blds.find(b => b.type === 'mill' && b.built);
        if (mill && this.afford(BUILDINGS.farm.cost)) {
          const anchor = (this.blds.filter(b => b.type === 'farm').length % 2 === 0 || !this.tc) ? mill : this.tc;
          const spot = this.findSpot('farm', anchor.x, anchor.z, 2, 10);
          if (spot) { const b = placeBuilding(this.pid, 'farm', spot.tx, spot.ty, [u]); if (typeof b === 'object') { asg.set(b.id, 1); return true; } }
        }
      }
    } else if (res === 'wood') {
      const drops = this.blds.filter(b => b.built && (b.type === 'lumbercamp' || b.type === 'towncenter'));
      for (const r of resources) {
        if (r.dead || r.rtype !== 'tree') continue;
        if (Math.abs(r.x - cx) > 40 || Math.abs(r.z - cz) > 40) continue;
        let d = Infinity; for (const b of drops) d = Math.min(d, rectDist(r.x, r.z, b));
        if (d === Infinity) d = Math.sqrt(dist2(r.x, r.z, cx, cz));
        consider(r, d + Math.random() * 1.5, 2);
      }
    } else {
      for (const r of resources) {
        if (r.dead || r.amount <= 0) continue;
        if (r.rtype === res) { const d = Math.sqrt(dist2(r.x, r.z, cx, cz)); consider(r, d + (d > 38 ? 30 : 0), 7); }
        else if (res === 'gold' && r.rtype === 'treasure' && campSafe(r.x, r.z)) { const d = Math.sqrt(dist2(r.x, r.z, cx, cz)); if (d < 60) consider(r, d - 12, 4); }
      }
    }
    if (!best) return false;
    orderGather(u, best);
    if (best.kind === 'resource' || best.kind === 'building') asg.set(best.id, (asg.get(best.id) || 0) + 1);
    if (res === 'gold' || res === 'stone') u.lastMine = res;
    return true;
  }
  // ------------------------------------------------------------------
  findSpot(type, cx, cz, rmin, rmax, strict = true) {
    const s = BUILDINGS[type].size;
    const camp = type === 'lumbercamp' || type === 'miningcamp' || type === 'mill';
    for (let r = rmin; r <= rmax; r++) {
      const cand = [];
      for (let k = -r; k <= r; k++) { cand.push([k, -r], [k, r]); if (k > -r && k < r) cand.push([-r, k], [r, k]); }
      for (let i = cand.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
      for (const [dx, dz] of cand) {
        const tx = Math.round(cx + dx - s / 2), ty = Math.round(cz + dz - s / 2);
        if (!canPlace(type, tx, ty, this.pid, true)) continue;
        if (type !== 'farm' && type !== 'wall' && !this.ringOk(tx, ty, s, camp ? 'bld' : 'all')) continue;
        if (type === 'farm' && !this.ringOk(tx, ty, s, 'bld')) continue;
        return { tx, ty };
      }
    }
    return null;
  }
  ringOk(tx, ty, s, mode) {
    for (let y = ty - 1; y <= ty + s; y++) for (let x = tx - 1; x <= tx + s; x++) {
      if (x >= tx && x < tx + s && y >= ty && y < ty + s) continue;
      if (!inb(x, y)) return false;
      const i = idx(x, y), o = World.occ[i];
      if (o) { const e = ents.get(o); if (e && e.kind === 'building' && !(mode === 'bld' && e.type === 'farm')) return false; if (mode === 'all' && e && e.kind === 'resource') return false; }
      else if (mode === 'all' && World.pass[i]) return false;
    }
    return true;
  }
  pickBuilders(x, z, n) {
    const c = this.vils.filter(u => !u.garrisonIn && u.state !== 'build' && u.state !== 'garrison' && !(u.state === 'return' && u.carry > 6))
      .sort((a, b) => dist2(a.x, a.z, x, z) - dist2(b.x, b.z, x, z));
    return c.slice(0, n);
  }
  build(type, x, z, rmin, rmax, nBuilders = 1) {
    if (!this.afford(BUILDINGS[type].cost, !['house', 'yurt', 'farm', 'lumbercamp', 'miningcamp', 'mill'].includes(type))) return null;
    const spot = this.findSpot(type, x, z, rmin, rmax);
    if (!spot) return null;
    const s = BUILDINGS[type].size;
    const bs = this.pickBuilders(spot.tx + s / 2, spot.ty + s / 2, nBuilders);
    if (!bs.length) return null;
    for (const u of bs) if (u.state === 'gather' || u.state === 'return') u.prev = { state: 'gather', id: u.gtarget };
    const b = placeBuilding(this.pid, type, spot.tx, spot.ty, bs);
    return typeof b === 'object' ? b : null;
  }
  construct(tc, cx, cz) {
    const p = this.p, pid = this.pid, blds = this.blds;
    const count = t => blds.filter(b => b.type === t).length;
    const unfinished = blds.filter(b => !b.built);
    if (unfinished.filter(b => b.type !== 'farm' && b.type !== 'house' && b.type !== 'wall').length > (p.age >= 1 ? 2 : 1)) {
      // make sure someone is building them
      for (const b of unfinished) { if (!units.some(u => u.owner === pid && !u.dead && u.state === 'build' && u.btarget === b.id)) { const bs = this.pickBuilders(b.x, b.z, 1); if (bs[0]) orderBuild(bs[0], b); } }
      return;
    }
    for (const b of unfinished) if (!units.some(u => u.owner === pid && !u.dead && u.state === 'build' && u.btarget === b.id)) { const bs = this.pickBuilders(b.x, b.z, 1); if (bs[0]) orderBuild(bs[0], b); }
    if (!tc) {
      if (p.age >= 1 && this.vils.length && canAfford(p, BUILDINGS.towncenter.cost)) this.build('towncenter', this.home.x, this.home.y, 0, 14, 4);
      return;
    }
    // houses
    const housesBuilding = unfinished.filter(b => (b.type === 'house' || b.type === 'yurt')).length;
    const margin = p.age === 0 ? 3 : 4 + this.cfg.house;
    if (p.popCap < POP_MAX && p.popCap - p.pop <= margin && housesBuilding < (p.age >= 1 ? 2 : 1)) {
      const a = Math.random() * Math.PI * 2; this.build(this.p.faction === 'wind' ? 'yurt' : 'house', cx - this.dir.x * 4 + Math.cos(a) * 3, cz - this.dir.z * 4 + Math.sin(a) * 3, 3, 12);
      if (p.popCap - p.pop <= 1) return;
    }
    const vn = this.vils.length;
    // mill near berries
    if (count('mill') === 0 && vn >= 6) {
      let br = null, bd = 1e9; for (const r of resources) if (!r.dead && r.rtype === 'berry') { const d = dist2(r.x, r.z, cx, cz); if (d < bd && d < 24 * 24) { bd = d; br = r; } }
      if (br) this.build('mill', br.x, br.z, 2, 5); else this.build('mill', cx, cz, 4, 9);
    }
    // lumber camp near the woodline
    if (vn >= 5 && this.cnt.wood >= 3) {
      const drops = blds.filter(b => (b.type === 'lumbercamp' || b.type === 'towncenter'));
      let bestT = null, bd = 1e9;
      for (const r of resources) { if (r.dead || r.rtype !== 'tree') continue; const d = dist2(r.x, r.z, cx, cz); if (d < bd && d < 34 * 34) { bd = d; bestT = r; } }
      if (bestT) {
        let dd = 1e9; for (const b of drops) dd = Math.min(dd, rectDist(bestT.x, bestT.z, b));
        if (dd > 6 && unfinished.every(b => b.type !== 'lumbercamp')) this.build('lumbercamp', bestT.x, bestT.z, 2, 5);
      }
    }
    // mining camps
    for (const res of ['gold', 'stone']) {
      if (this.cnt[res] < 2 && !(p.age === 0 && vn >= 11 && eligibleQualify(pid, 0) < 2 && res === 'gold')) continue;
      let mine = null, bd = 1e9; for (const r of resources) if (!r.dead && r.rtype === res) { const n = this.assigned && this.assigned.get(r.id); if (!n) continue; const d = dist2(r.x, r.z, cx, cz); if (d < bd) { bd = d; mine = r; } }
      if (!mine) continue;
      let dd = 1e9; for (const b of blds) if (b.type === 'miningcamp' || b.type === 'towncenter') dd = Math.min(dd, rectDist(mine.x, mine.z, b));
      if (dd > 5 && unfinished.every(b => b.type !== 'miningcamp')) this.build('miningcamp', mine.x, mine.z, 2, 4);
    }
    // military
    if (p.age >= 1) {
      // the realm's unique building: once a military building stands, hold its price back from other spending
      const ub = REALM_BUILD[p.faction];
      this.hold = null;
      if (ub && ub !== 'yurt' && p.age >= BUILDINGS[ub].age && count(ub) < (BUILDINGS[ub].limit > 1 ? 2 : 1) && vn >= 14 && this.diff !== 'easy' && blds.some(b => b.type === 'barracks' || b.type === 'range' || b.type === 'stable') && unfinished.every(b => b.type !== ub)) {
        if (this.build(ub, cx + this.dir.x * 6, cz + this.dir.z * 6, 2, 14, 2)) this.saveT = undefined;
        else { if (this.saveT === undefined) this.saveT = Game.time; if (Game.time - this.saveT < 360) this.hold = BUILDINGS[ub].cost; }
      }
      const plan = []; for (let a = 1; a <= p.age; a++) plan.push(...(this.cfg.milB[a] || []));
      if ((p.faction === 'wind' || p.faction === 'crimson') && !plan.slice(0, 2).includes('stable')) plan.splice(1, 0, 'stable');
      const have = {}; for (const b of blds) have[b.type] = (have[b.type] || 0) + 1;
      const need = {};
      for (const t of plan) {
        need[t] = (need[t] || 0) + 1;
        if ((have[t] || 0) < need[t]) {
          if (t === 'castle') { this.wantStone = true; if (!this.afford(BUILDINGS.castle.cost)) break; }
          const sx = cx + this.dir.x * 8, sz = cz + this.dir.z * 8;
          this.build(t, sx, sz, 2, 14, t === 'castle' ? 4 : 2);
          break;
        }
      }
      // extra towers on hard
      if (this.diff === 'hard' && p.age >= 1 && count('tower') < 2 && p.res.stone > 250 && vn > 20) this.build('tower', cx + this.dir.x * 7, cz + this.dir.z * 7, 2, 8, 1);
    }
  }
  // ------------------------------------------------------------------
  produce() {
    const p = this.p;
    if (this.army.length >= this.cfg.maxArmy || p.pop >= p.popCap) return;
    if (p.age === 0) return;
    // a couple of herbalists to patch up the army
    if (this.diff !== 'easy' && this.tc && this.tc.built && this.army.length >= 6 && this.tc.queue.length < 2) {
      const healers = units.filter(u => u.owner === this.pid && u.type === 'healer' && !u.dead).length;
      if (healers < (this.diff === 'hard' ? 3 : 2) && this.afford(UNITS.healer.cost)) queueTrain(this.tc, 'healer');
    }
    for (const b of this.blds) {
      if (!b.built || !BUILDINGS[b.type].trains || b.type === 'towncenter' || b.queue.length >= 2) continue;
      if (!b.rally) b.rally = { x: this.stage.x + rand(-2, 2), z: this.stage.z + rand(-2, 2) };
      const ut = this.pickUnit(b.type);
      if (ut && this.afford(UNITS[ut].cost, this.army.length >= 6)) queueTrain(b, ut);
    }
  }
  pickUnit(btype) {
    const p = this.p, age = p.age, s = this.seenUnits;
    const tot = (s.infantry || 0) + (s.archer || 0) + (s.cavalry || 0) + 0.01;
    const cav = (s.cavalry || 0) / tot, arc = (s.archer || 0) / tot, inf = (s.infantry || 0) / tot;
    const ctr = this.cfg.counter;
    const w = {};
    if (btype === 'barracks') { w.spearman = ctr ? 0.2 + cav * 2 : 0.5; w.swordsman = ctr ? 0.3 + arc * 0.5 + inf : 0.5; }
    else if (btype === 'range') { if (age >= 2) w.crossbow = 1; else w.archer = 1; if (ctr && cav > 0.5) { w.crossbow && (w.crossbow = 0.3); w.archer && (w.archer = 0.3); } }
    else if (btype === 'stable') { if (age >= 2) { w.knight = ctr ? 0.4 + arc * 2 : 0.7; w.scout = 0.15; } else w.scout = 1; }
    else if (btype === 'workshop') { const siege = this.army.filter(u => UNITS[u.type].cls === 'siege').length; if (siege >= (this.diff === 'hard' ? 5 : 3)) return null; w.ram = 0.6; w.catapult = 0.4; }
    else if (btype === 'castle') { w.knight = 0.5; w.crossbow = 0.5; }
    for (const ut of BUILDINGS[btype].trains || []) { const ud = UNITS[ut]; if (ud.realm) { if (ud.realm === p.faction) w[ut] = 1.3; else delete w[ut]; } else if (w[ut] === undefined && (btype === 'warhall' || btype === 'clanhall')) w[ut] = 0.35; }
    const ru = REALM_UNIT[p.faction];
    if (w[ru] && UNITS[ru].age <= age && this.cnt.gold > 0 && this.army.filter(u => u.type === ru).length < this.army.length * 0.4 + 2 && Math.random() < 0.7) return ru;   // wait for the gold rather than settle for something cheaper
    const opts = Object.keys(w).filter(k => UNITS[k].age <= age && w[k] > 0);
    if (!opts.length) return null;
    const aff = opts.filter(k => this.afford(UNITS[k].cost));
    const list = aff.length ? aff : opts;
    let sum = 0; for (const k of list) sum += w[k];
    let r = Math.random() * sum; for (const k of list) { r -= w[k]; if (r <= 0) return k; }
    return list[0];
  }
  research(tc) {
    const p = this.p;
    if (!tc || !tc.built) return;
    // age up
    const ageT = p.age === 0 ? 'feudal' : p.age === 1 ? 'iron' : null;
    if (ageT && !p.researching.has(ageT) && this.vils.length >= (p.age === 0 ? 11 : 19) && techBlock(tc, ageT) === null && tc.queue.length <= 1) {
      if (tc.queue.length === 1 && tc.queue[0].t < tc.queue[0].total * 0.5) cancelQueue(tc, 0);
      queueTech(tc, ageT); return;
    }
    if (Math.random() > this.cfg.techs) return;
    // building upgrades when the treasury is healthy
    if (p.age >= 1 && p.res.wood > 450 && p.res.stone > 250 && Math.random() < 0.3) {
      for (const b of this.blds) { if (!['towncenter', 'tower', 'barracks', 'range', 'castle'].includes(b.type)) continue; if (upgradeBlock(b) === null && this.afford(upgradeCost(b))) { queueUpgrade(b); return; } }
    }
    const opts = [];
    const vn = this.vils.length;
    if (vn >= 16 || (this.lastHit && Game.time - this.lastHit.time < 20)) opts.push(['loom', tc]);
    if (p.age >= 1 && vn >= 18) opts.push(['wheelbarrow', tc]);
    for (const b of this.blds) {
      if (!b.built || b.queue.length) continue;
      if (b.type === 'lumbercamp' && this.cnt.wood >= 5) opts.push(['doublebit', b], ['bowsaw', b]);
      if (b.type === 'miningcamp' && this.cnt.gold >= 3) opts.push(['goldmining', b]);
      if (b.type === 'miningcamp' && this.cnt.stone >= 3) opts.push(['stonemining', b]);
      if (b.type === 'mill' && this.blds.filter(x => x.type === 'farm').length >= 3) opts.push(['horsecollar', b]);
      if (b.type === 'blacksmith' && this.army.length >= 5) for (const t of BUILDINGS.blacksmith.techs) opts.push([t, b]);
    }
    for (const [t, b] of opts) {
      if (p.techs.has(t) || p.researching.has(t)) continue;
      if (t === 'loom' || t === 'wheelbarrow') { if (b.queue.length >= 1) continue; }
      if (techBlock(b, t) === null && this.afford(TECHS[t].cost)) { queueTech(b, t); return; }
    }
  }
  // ------------------------------------------------------------------
  scouting() {
    const sc = this.scoutId ? ents.get(this.scoutId) : null;
    if (!this.scoutPts) {
      const first = units.find(u => u.owner === this.pid && u.type === 'scout' && !u.dead);
      if (!first) return;
      this.scoutId = first.id;
      const h = this.home, e = this.enemyStart, pts = [];
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pts.push({ x: clamp(h.x + Math.cos(a) * 18, 4, N - 4), z: clamp(h.y + Math.sin(a) * 18, 4, N - 4) }); }
      pts.push({ x: N / 2, z: N / 2 });
      if (this.diff !== 'easy') pts.push({ x: lerp(h.x, e.x, 0.78) + this.dir.z * 12, z: lerp(h.y, e.y, 0.78) - this.dir.x * 12 }, { x: lerp(h.x, e.x, 0.85), z: lerp(h.y, e.y, 0.85) }, { x: lerp(h.x, e.x, 0.78) - this.dir.z * 12, z: lerp(h.y, e.y, 0.78) + this.dir.x * 12 });
      pts.push({ x: this.stage.x, z: this.stage.z });
      this.scoutPts = pts; this.scoutI = 0;
      orderMove(first, pts[0].x, pts[0].z);
      return;
    }
    if (!sc || sc.dead) { this.scoutId = 0; return; }
    if (sc.state === 'idle') {
      this.scoutI++;
      if (this.scoutI >= this.scoutPts.length) { this.scoutId = 0; return; }
      const pt = this.scoutPts[this.scoutI]; orderMove(sc, pt.x, pt.z);
    }
    if (sc.hp < sc.maxHp * 0.5 && sc.state !== 'move') { orderMove(sc, this.stage.x, this.stage.z); this.scoutId = 0; }
  }
  offense() {
    const army = this.army.filter(u => !u.garrisonIn);
    const t = Game.time;
    const toStage = list => { for (const u of list) if (u.state === 'idle' && dist2(u.x, u.z, this.stage.x, this.stage.z) > 8 * 8 && dist2(u.x, u.z, this.cx, this.cz) < 45 * 45) orderMove(u, this.stage.x + rand(-2, 2), this.stage.z + rand(-2, 2)); };
    if (!this.attacking) {
      // between waves: clear a nearby hostile camp so villagers can loot its treasure
      if (this.clearing && (t > this.clearing.until || campSafe(this.clearing.x, this.clearing.z))) this.clearing = null;
      if (!this.clearing && army.length >= (this.diff === 'easy' ? 8 : 5) && t > 6 * 60 && t < this.attackT + 40) {
        let best = null, bd = 55 * 55;
        for (const c of World.camps || []) { const x = c.tx + 0.5, z = c.ty + 0.5; if (campSafe(x, z) || !resources.some(r => !r.dead && r.rtype === 'treasure' && dist2(r.x, r.z, x, z) < 9)) continue; const d = dist2(x, z, this.cx, this.cz); if (d < bd) { bd = d; best = { x, z }; } }
        if (best) { this.clearing = { x: best.x, z: best.z, until: t + 100 }; formationMove(army, best.x, best.z, true); return; }
      }
      if (this.clearing) return;
      const need = this.cfg.wave + this.wave * this.cfg.grow;
      const ready = t >= this.attackT && (army.length >= need || (t >= this.attackT + 50 && army.length >= 4) || (t >= this.attackT + 100 && army.length >= 2) || army.length >= this.cfg.maxArmy * 0.85);
      if (ready && army.length) {
        this.attacking = true; this.attackSince = t; this.wave++;
        this.waveIds = new Set(army.map(u => u.id));
        const tgt = this.pickTarget(army);
        this.attackPos = tgt;
        formationMove(army, tgt.x, tgt.z, true);
        let ax = 0, az = 0; for (const u of army) { ax += u.x; az += u.z; } ax /= army.length; az /= army.length;
        for (const h of units) if (h.owner === this.pid && h.type === 'healer' && !h.dead) orderMove(h, lerp(ax, tgt.x, 0.7) + rand(-1, 1), lerp(az, tgt.z, 0.7) + rand(-1, 1));
      } else toStage(army);
      return;
    }
    const wave = army.filter(u => this.waveIds.has(u.id));
    toStage(army.filter(u => !this.waveIds.has(u.id)));
    if (wave.length < 2 && t - this.attackSince > 15) {
      this.attacking = false; this.attackT = t + (this.diff === 'hard' ? 40 : this.diff === 'standard' ? 60 : 110);
      for (const u of wave) orderMove(u, this.stage.x, this.stage.z);
      return;
    }
    const tgt = this.pickTarget(wave);
    this.attackPos = tgt;
    for (const u of wave) if (u.state === 'idle') orderAttackMove(u, tgt.x + rand(-1.5, 1.5), tgt.z + rand(-1.5, 1.5));
  }
  pickTarget(army) {
    let ax = 0, az = 0; for (const u of army) { ax += u.x; az += u.z; } ax /= army.length || 1; az /= army.length || 1;
    let best = null, bd = Infinity;
    for (const b of this.known.values()) {
      if (b.dead) continue;
      let d = Math.sqrt(dist2(ax, az, b.x, b.z));
      if (b.type === 'wall') d += 25; if (b.type === 'towncenter' || b.type === 'wonder') d -= 6; if (b.type === 'tower' || b.type === 'castle') d += 6;
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { const ep = edgePoint(best, ax, az, 0.8); return { x: ep.x, z: ep.z }; }
    // nothing known: look for any visible enemy unit, else head to the enemy's start
    let eu = null; bd = Infinity;
    for (const u of units) if (u.owner === this.enemy && !u.dead && !u.garrisonIn && this.p.vis[idx(u.x | 0, u.z | 0)]) { const d = dist2(ax, az, u.x, u.z); if (d < bd) { bd = d; eu = u; } }
    if (eu) return { x: eu.x, z: eu.z };
    const vis = this.p.vis;
    if (!vis[idx(this.enemyStart.x | 0, this.enemyStart.y | 0)] && !this.visitedStart) return { x: this.enemyStart.x + rand(-4, 4), z: this.enemyStart.y + rand(-4, 4) };
    this.visitedStart = true;
    // explore: closest grid point we cannot currently see (prefer unexplored)
    let bp = null, bs = Infinity; this.visited = this.visited || new Set();
    for (let y = 4; y < N; y += 8) for (let x = 4; x < N; x += 8) {
      const i = idx(x, y); if (vis[i] || this.visited.has(i)) continue;
      const nf = nearestFree(x + 0.5, y + 0.5, this.pid, 3); if (!nf) continue;
      const sc = Math.sqrt(dist2(ax, az, x, y)) - (this.p.exp[i] ? 0 : 30) + Math.random() * 12;
      if (sc < bs) { bs = sc; bp = { x: nf.x, z: nf.z, i }; }
    }
    if (bp) { this.visited.add(bp.i); if (this.visited.size > 60) this.visited.clear(); return bp; }
    return { x: this.enemyStart.x, z: this.enemyStart.y };
  }
}

// =====================================================================
//  AUTO-WORK — keeps the human player's idle villagers busy
//  (gathers what the economy needs most, builds farms & houses)
// =====================================================================
const AutoWork = {
  helper: null, t: 0, houseT: 0,
  reset() { this.helper = null; this.t = 0; this.houseT = 0; },
  update(dt) {
    if (Game.mode !== 'play' || !Settings.autoWork || players[HUMAN].isAI) return;
    this.t -= dt; this.houseT -= dt;
    if (this.t > 0) return;
    this.t = 0.8;
    const p = players[HUMAN];
    const h = this.helper || (this.helper = new AIPlayer(HUMAN, 'standard'));
    h.vils = units.filter(u => u.owner === HUMAN && u.type === 'villager' && !u.dead);
    h.blds = buildings.filter(b => b.owner === HUMAN && !b.dead);
    h.tc = h.blds.find(b => b.type === 'towncenter' && b.built);
    h.cx = h.tc ? h.tc.x : World.starts[HUMAN].x; h.cz = h.tc ? h.tc.z : World.starts[HUMAN].y;
    h.reserve = {};
    const cnt = { food: 0, wood: 0, gold: 0, stone: 0 }, asg = new Map();
    for (const u of h.vils) if ((u.state === 'gather' || u.state === 'return') && u.gres) { cnt[u.gres]++; if (u.gtarget) asg.set(u.gtarget, (asg.get(u.gtarget) || 0) + 1); }
    h.assigned = asg; h.cnt = cnt;
    // houses before the population cap is hit
    if (this.houseT <= 0 && p.popCap < POP_MAX && p.popCap - p.pop <= 2 && canAfford(p, BUILDINGS.house.cost) && !h.blds.some(b => (b.type === 'house' || b.type === 'yurt') && !b.built)) {
      this.houseT = 8;
      const a = Math.random() * Math.PI * 2;
      if (h.build(p.faction === 'wind' ? 'yurt' : 'house', h.cx - h.dir.x * 4 + Math.cos(a) * 3, h.cz - h.dir.z * 4 + Math.sin(a) * 3, 3, 12)) UI.notify('Auto-work: building a House', '', 'autohouse');
    }
    // claim hunted food: any unclaimed carcass we can see/explored gets villagers sent to it
    for (const r of resources) {
      if (r.dead || r.rtype !== 'carcass' || r.amount <= 0) continue;
      if (!p.exp[idx(r.x | 0, r.z | 0)]) continue;
      const have = asg.get(r.id) || 0, need = r.amount > 60 ? 2 : 1;
      if (have >= need) continue;
      const cands = h.vils.filter(u => !u.garrisonIn && !u.parked && u.gtarget !== r.id && dist2(u.x, u.z, r.x, r.z) < 45 * 45 &&
        (u.state === 'idle' || ((u.state === 'gather') && u.gkind !== 'hunt' && u.carry < 4)));
      // prefer idle, then food gatherers, then the closest
      cands.sort((a, b) => ((a.state === 'idle' ? 0 : a.gres === 'food' ? 30 : 60) + Math.sqrt(dist2(a.x, a.z, r.x, r.z))) - ((b.state === 'idle' ? 0 : b.gres === 'food' ? 30 : 60) + Math.sqrt(dist2(b.x, b.z, r.x, r.z))));
      for (let k = 0; k < need - have && k < cands.length; k++) { orderGather(cands[k], r); asg.set(r.id, (asg.get(r.id) || 0) + 1); }
    }
    const idle = h.vils.filter(u => u.state === 'idle' && !u.garrisonIn && !u.parked && (u.idleT || 0) > 1.2);
    if (!idle.length) return;
    const total = h.vils.length;
    const want = p.age === 0 ? { food: 0.55, wood: 0.35, gold: 0.07, stone: 0.03 } : p.age === 1 ? { food: 0.45, wood: 0.3, gold: 0.2, stone: 0.05 } : { food: 0.4, wood: 0.28, gold: 0.25, stone: 0.07 };
    const deficit = r => want[r] * total - cnt[r] - Math.min(2, p.res[r] / 400);
    for (const u of idle) {
      if (u.gkind) { const r = findGatherTarget(u, u.gkind, 10); if (r) { orderGather(u, r); continue; } }
      const order = RESN.slice().sort((a, b) => deficit(b) - deficit(a));
      for (const r of order) if (h.assignGather(u, r)) { cnt[r]++; break; }
    }
  },
};
