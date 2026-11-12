// =====================================================================
//  CAMERA + INPUT (mouse, keyboard, touch)
// =====================================================================
const Cam = { x: 20, z: 20, dist: 30, tdist: 30, yaw: Math.PI / 4 + Math.PI, tyaw: Math.PI / 4 + Math.PI, pitch: 0.9, h: 0, pitchOverride: null, saved: null };
const camMaxDist = () => Math.max(60, N * 1.3);
// ---- view controller actions (buttons, keys, touch) ----
const View2 = {
  rotate(d) { Cam.tyaw += d; },
  tilt(d) { const cur = Cam.pitchOverride !== null ? Cam.pitchOverride : Cam.pitch; Cam.pitchOverride = clamp(cur + d, 0.32, 1.52); },
  zoom(f) { Cam.tdist = clamp(Cam.tdist * f, 6, camMaxDist()); },
  top() { Cam.pitchOverride = Cam.pitchOverride !== null && Cam.pitchOverride > 1.4 ? null : 1.52; },
  overview() {
    if (Cam.saved) { Object.assign(Cam, { x: Cam.saved.x, z: Cam.saved.z, tdist: Cam.saved.tdist, pitchOverride: Cam.saved.pitchOverride }); Cam.saved = null; return; }
    Cam.saved = { x: Cam.x, z: Cam.z, tdist: Cam.tdist, pitchOverride: Cam.pitchOverride };
    Cam.x = N / 2; Cam.z = N / 2; Cam.tdist = N * 1.12; Cam.pitchOverride = 1.12;
  },
  reset() { Cam.pitchOverride = null; Cam.saved = null; Cam.tyaw = Math.PI / 4 + Math.PI + Math.round((Cam.tyaw - Math.PI * 1.25) / (Math.PI * 2)) * Math.PI * 2; Cam.tdist = IS_MOBILE ? 22 : 26; },
  preset(d) { Cam.saved = null; Cam.pitchOverride = null; Cam.tdist = d; },
};
function applyCamera(dt) {
  Cam.tdist = clamp(Cam.tdist, 6, camMaxDist());
  Cam.dist += (Cam.tdist - Cam.dist) * Math.min(1, dt * 10);
  let dy = Cam.tyaw - Cam.yaw; Cam.yaw += dy * Math.min(1, dt * 10);
  Cam.x = clamp(Cam.x, 0, N); Cam.z = clamp(Cam.z, 0, N);
  const th = heightAt(Cam.x, Cam.z); Cam.h += (Math.max(0, th) - Cam.h) * Math.min(1, dt * 4);
  const autoPitch = lerp(0.68, 1.08, clamp((Cam.dist - 9) / 60, 0, 1));
  Cam.pitch += ((Cam.pitchOverride !== null ? Cam.pitchOverride : autoPitch) - Cam.pitch) * Math.min(1, dt * 8);
  scene.fog.near = 60 + Cam.dist * 1.2; scene.fog.far = 170 + Cam.dist * 2.4;
  if (camera.far < 1200) { camera.far = 1200; camera.updateProjectionMatrix(); }
  const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  camera.position.set(Cam.x + Math.sin(Cam.yaw) * cp * Cam.dist, Cam.h + sp * Cam.dist, Cam.z + Math.cos(Cam.yaw) * cp * Cam.dist);
  camera.lookAt(Cam.x, Cam.h, Cam.z);
  if (window.skyDome) skyDome.position.copy(camera.position);
  sun.position.set(Cam.x + 26, 48, Cam.z + 16); sun.target.position.set(Cam.x, 0, Cam.z); sun.target.updateMatrixWorld();
  const sh = clamp(Cam.dist * 0.9 + 10, 22, 90); const sc = sun.shadow.camera;
  if (Math.abs(sc.right - sh) > 2) { sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.updateProjectionMatrix(); }
}
function camJump(x, z) { Cam.x = clamp(x, 0, N); Cam.z = clamp(z, 0, N); }

const Input = (() => {
  let sel = [];
  const keys = {};
  const groups = {};
  let mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false, down: false, sx: 0, sy: 0, btn: -1, rotating: false };
  let place = null;      // {type, wallStart}
  let lastClick = { t: 0, id: 0 }, lastGroup = { n: 0, t: 0 };
  let boxMode = false, actMode = false, amoveMode = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v3 = new THREE.Vector3();
  let canvas;

  // ---- custom cursors + hover target ----
  let hover = null;
  const CUR = {};
  function makeCursor(kind) {
    if (CUR[kind]) return CUR[kind];
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const poly = (pts, fill, stroke, lw = 2) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); };
    let hx = 2, hy = 2;
    if (kind === 'default') poly([2, 2, 2, 23, 8, 18, 12, 27, 16, 25, 12, 16, 20, 16], '#f0d48a', '#2a1c10');
    else if (kind === 'attack') { poly([3, 3, 9, 4, 24, 19, 21, 22, 6, 7], '#e9eef4', '#5a1410'); poly([17, 24, 25, 16, 27, 18, 19, 26], '#c9a24a', '#5a1410'); poly([23, 24, 29, 30, 27, 30, 22, 26], '#8a2a1a', '#5a1410'); }
    else if (kind === 'gather') { poly([4, 6, 10, 2, 16, 4, 12, 10], '#c9d2da', '#2a1c10'); poly([10, 8, 13, 5, 30, 26, 27, 29], '#a0763e', '#2a1c10'); hx = 6; hy = 5; }
    else if (kind === 'build') { poly([3, 9, 11, 2, 18, 9, 10, 16], '#9aa3ad', '#2a1c10'); poly([11, 12, 14, 9, 30, 26, 27, 29], '#a0763e', '#2a1c10'); hx = 6; hy = 6; }
    else if (kind === 'select') { poly([2, 2, 2, 23, 8, 18, 12, 27, 16, 25, 12, 16, 20, 16], '#ffffff', '#2a1c10'); }
    return (CUR[kind] = `url(${c.toDataURL()}) ${hx} ${hy}, ${kind === 'attack' ? 'crosshair' : 'auto'}`);
  }
  function updateHover(sx, sy) {
    const t = pickAt(sx, sy); hover = t;
    const own = sel.filter(e => e.owner === HUMAN && !e.dead && e.kind === 'unit'), vils = own.some(u => u.type === 'villager');
    let kind = t ? 'select' : 'default';
    if (own.length && t) {
      if ((t.kind === 'unit' || t.kind === 'building') && (isEnemy(HUMAN, t.owner) || (t.kind === 'unit' && (isCreep(t) || UNITS[t.type].hostile)))) kind = 'attack';
      else if (vils && (t.kind === 'resource' || (t.kind === 'unit' && isAnimal(t)) || (t.kind === 'building' && t.owner === HUMAN && t.type === 'farm' && t.built))) kind = 'gather';
      else if (vils && t.kind === 'building' && t.owner === HUMAN && (!t.built || t.hp < t.maxHp)) kind = 'build';
    }
    canvas.style.cursor = makeCursor(kind);
  }
  function selection() { return sel; }
  function setSelection(list) { sel = list.filter(e => e && !e.dead); UI.selChanged(); }
  function deselectEnt(e) { const i = sel.indexOf(e); if (i >= 0) { sel.splice(i, 1); UI.selChanged(); } }
  function cleanSelection() {
    const n = sel.length;
    sel = sel.filter(e => !e.dead && !e.garrisonIn && (e.kind !== 'resource' || ents.has(e.id)) && !(e.kind === 'unit' && e.owner !== HUMAN && !View.visibleToHuman(e.x, e.z)));
    if (sel.length !== n) UI.selChanged();
  }

  // ---------------- projection helpers ----------------
  function screenToGround(sx, sy) {
    ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let t = 0, prev = 0;
    for (let i = 0; i < 400; i++) {
      const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
      if (py <= heightAt(px, pz)) {
        let a = prev, b = t;
        for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (o.y + d.y * m <= heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
      prev = t; t += 0.4;
      if (py < -5) break;
    }
    if (d.y < 0) { const tt = -o.y / d.y; return { x: o.x + d.x * tt, z: o.z + d.z * tt }; }
    return null;
  }
  function project(x, y, z) { v3.set(x, y, z).project(camera); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, z: v3.z }; }
  function pickAt(sx, sy) {
    let best = null, bd = Infinity;
    const thr = clamp(700 / Cam.dist, 12, 46);
    for (const u of units) {
      if (u.dead || u.garrisonIn) continue;
      if (u.owner !== HUMAN && !View.visibleToHuman(u.x, u.z)) continue;
      const cav = UNITS[u.type].cls === 'cavalry' || UNITS[u.type].cls === 'siege';
      const s = project(u.x, heightAt(u.x, u.z) + (cav ? 0.6 : 0.4), u.z);
      if (s.z > 1) continue;
      const d = (s.x - sx) ** 2 + (s.y - sy) ** 2;
      if (d < thr * thr * (cav ? 1.5 : 1) && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    let bb = null; bd = Infinity;
    const ppu = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const b of buildings) {
      if (b.dead || !b.mesh || !b.mesh.visible) continue;
      const hgt = b.size >= 3 ? 1.1 : b.size === 1 ? 0.5 : 0.7;
      const s = project(b.x, b.y + hgt, b.z); if (s.z > 1) continue;
      const depth = camera.position.distanceTo(v3.set(b.x, b.y + hgt, b.z));
      const r = b.size * 0.55 * ppu / depth;
      const d = Math.sqrt((s.x - sx) ** 2 + (s.y - sy) ** 2) / r;
      if (d < 1 && d < bd) { bd = d; bb = b; }
    }
    if (bb) return bb;
    const g = screenToGround(sx, sy); if (!g) return null;
    const tx = Math.floor(g.x), ty = Math.floor(g.z); if (!inb(tx, ty)) return null;
    if (Game.mode === 'play' && !players[HUMAN].exp[idx(tx, ty)]) return null;
    const e = ents.get(World.occ[idx(tx, ty)]);
    if (e) return e;
    // carcasses do not occupy tiles
    for (const r of resources) if (r.rtype === 'carcass' && !r.dead && dist2(r.x, r.z, g.x, g.z) < 0.6) return r;
    return null;
  }

  // ---------------- selection ----------------
  function clickSelect(sx, sy, shift, dbl) {
    const e = pickAt(sx, sy);
    if (!e) { if (!shift) setSelection([]); return; }
    if (dbl && e.owner === HUMAN) {
      const list = [];
      if (e.kind === 'unit') { for (const u of units) if (!u.dead && !u.garrisonIn && u.owner === HUMAN && u.type === e.type) { const s = project(u.x, heightAt(u.x, u.z), u.z); if (s.x >= 0 && s.y >= 0 && s.x <= innerWidth && s.y <= innerHeight && s.z < 1) list.push(u); } }
      else for (const b of buildings) if (!b.dead && b.owner === HUMAN && b.type === e.type) { const s = project(b.x, b.y, b.z); if (s.x >= 0 && s.y >= 0 && s.x <= innerWidth && s.y <= innerHeight && s.z < 1) list.push(b); }
      setSelection(list); return;
    }
    if (shift && e.kind === 'unit' && e.owner === HUMAN && sel.every(s => s.kind === 'unit' && s.owner === HUMAN)) {
      const i = sel.indexOf(e); if (i >= 0) sel.splice(i, 1); else sel.push(e); setSelection(sel.slice()); return;
    }
    setSelection([e]);
    Sound.play('click', undefined, undefined, 0.5);
  }
  function boxSelect(x0, y0, x1, y1, shift) {
    const a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), d = Math.max(y0, y1);
    const list = shift ? sel.filter(e => e.kind === 'unit' && e.owner === HUMAN) : [];
    for (const u of units) {
      if (u.dead || u.garrisonIn || u.owner !== HUMAN) continue;
      const s = project(u.x, heightAt(u.x, u.z) + 0.3, u.z);
      if (s.x >= a && s.x <= b && s.y >= c && s.y <= d && s.z < 1 && !list.includes(u)) list.push(u);
    }
    if (list.length) { const mil = list.filter(isMil); setSelection(mil.length && mil.length < list.length && !shift ? (list.length - mil.length > mil.length ? list : list) : list); Sound.play('click', undefined, undefined, 0.5); }
    else if (!shift) setSelection([]);
  }

  // ---------------- context (right click) ----------------
  function contextAction(sx, sy, gOverride) {
    const own = sel.filter(e => e.owner === HUMAN && !e.dead);
    if (!own.length) return;
    const g = gOverride || screenToGround(sx, sy); if (!g) return;
    g.x = clamp(g.x, 0.3, N - 0.3); g.z = clamp(g.z, 0.3, N - 0.3);
    const t = gOverride ? null : pickAt(sx, sy);
    if (own[0].kind === 'building') {
      for (const b of own) if (BUILDINGS[b.type].trains) b.rally = { x: g.x, z: g.z, id: t && (t.kind === 'resource' || (t.kind === 'building' && t.owner === HUMAN)) ? t.id : 0 };
      View.showMoveMarker(g.x, g.z, 0xf3c969); Sound.play('click'); return;
    }
    const us = own.filter(e => e.kind === 'unit');
    const vils = us.filter(u => u.type === 'villager'), mil = us.filter(u => u.type !== 'villager');
    if (t && (t.kind === 'unit' || t.kind === 'building') && isEnemy(HUMAN, t.owner)) {
      for (const u of us) orderAttack(u, t);
      View.showMoveMarker(t.x, t.z, 0xff5a4a); Sound.play('click'); return;
    }
    if (t && t.kind === 'unit' && !t.dead && (isCreep(t) || (isAnimal(t) && UNITS[t.type].hostile))) {
      for (const u of us) orderAttack(u, t);
      View.showMoveMarker(t.x, t.z, 0xff5a4a); Sound.play('click'); return;
    }
    if (t && t.kind === 'unit' && isAnimal(t) && !t.dead) {
      for (const u of vils) orderGather(u, t);
      for (const u of mil) orderAttack(u, t);
      View.showMoveMarker(t.x, t.z, 0xf3c969); Sound.play('click'); return;
    }
    if (t && t.kind === 'resource') {
      for (const u of vils) orderGather(u, t);
      if (mil.length) formationMove(mil, g.x, g.z);
      View.showMoveMarker(t.x, t.z, 0xf3c969); Sound.play('click'); return;
    }
    if (t && t.kind === 'building' && t.owner === HUMAN) {
      let farmTaken = false;
      for (const u of vils) {
        if (!t.built || t.hp < t.maxHp) orderBuild(u, t);
        else if (t.type === 'farm') { if (!farmTaken) { orderGather(u, t); farmTaken = true; } else orderMove(u, t.x + rand(-1.5, 1.5), t.z + rand(-1.5, 1.5)); }
        else if (u.carry > 0 && BUILDINGS[t.type].drop && BUILDINGS[t.type].drop.includes(u.carryType)) { const keep = u.gtarget; startReturn(u); u.dropId = t.id; u.gtarget = keep; }
        else if (canGarrison(u, t)) orderGarrison(u, t);
        else orderMove(u, g.x, g.z);
      }
      for (const u of mil) { if (canGarrison(u, t) && t.built) orderGarrison(u, t); else orderMove(u, g.x, g.z); }
      View.showMoveMarker(t.x, t.z, 0xf3c969); Sound.play('click'); return;
    }
    formationMove(us, g.x, g.z);
    for (const u of vils) u.parked = true;
    View.showMoveMarker(g.x, g.z); Sound.play('click');
  }

  // ---------------- placement ----------------
  function startPlace(type) { place = { type, wallStart: null }; UI.notify(type === 'wall' ? 'Click the start, then the end of the wall' : 'Place ' + BUILDINGS[type].name + ' (right click to cancel)', '', 'place'); }
  function cancelPlace() { place = null; View.clearGhost(); }
  function placeTile(g, type) { const s = BUILDINGS[type].size; return { tx: Math.round(g.x - s / 2), ty: Math.round(g.z - s / 2) }; }
  function wallLine(x0, y0, x1, y1) {
    const out = []; let x = x0, y = y0; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy;
    out.push([x, y]);
    let guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 200) {
      const e2 = 2 * err;
      if (e2 > -dy && e2 < dx) { err -= dy; x += sx; out.push([x, y]); err += dx; y += sy; out.push([x, y]); }
      else if (e2 > -dy) { err -= dy; x += sx; out.push([x, y]); }
      else { err += dx; y += sy; out.push([x, y]); }
    }
    return out.slice(0, 48);
  }
  function placeList(g) {
    if (!place || !g) return [];
    const type = place.type;
    if (type === 'wall' && place.wallStart) {
      const e = placeTile(g, 'wall');
      return wallLine(place.wallStart.tx, place.wallStart.ty, e.tx, e.ty).map(([tx, ty]) => ({ type, tx, ty, ok: canPlace(type, tx, ty, HUMAN) }));
    }
    const t = placeTile(g, type);
    return [{ type, tx: t.tx, ty: t.ty, ok: canPlace(type, t.tx, t.ty, HUMAN) && canAfford(players[HUMAN], BUILDINGS[type].cost) }];
  }
  function updateGhost() {
    if (!place) return;
    const g = screenToGround(mouse.x, mouse.y);
    View.ghost(placeList(g));
  }
  function doPlace(sx, sy, shift) {
    const g = screenToGround(sx, sy); if (!g) return;
    const type = place.type;
    const builders = sel.filter(e => e.kind === 'unit' && e.type === 'villager' && e.owner === HUMAN && !e.dead);
    const p = players[HUMAN];
    if (type === 'wall' && !place.wallStart) { place.wallStart = placeTile(g, 'wall'); return; }
    const list = placeList(g);
    let placed = 0, err = null, first = null;
    for (const it of list) {
      if (!it.ok && type !== 'wall') { err = canAfford(p, BUILDINGS[type].cost) ? 'Cannot build there' : 'Not enough ' + missingRes(p, BUILDINGS[type].cost); break; }
      if (!it.ok) continue;
      const r = placeBuilding(HUMAN, type, it.tx, it.ty, first ? null : builders);
      if (typeof r === 'string') { err = r; if (r.startsWith('Not enough')) break; continue; }
      placed++; if (!first) first = r;
    }
    if (placed) { Sound.play('place'); if (type === 'wall') for (const u of builders) { u.btarget = first.id; } }
    if (err && !placed) { UI.notify(err, 'warn', 'err' + err); Sound.play('error'); if (err.startsWith('Not enough')) UI.flashRes(err.split(' ').pop()); }
    else if (err) UI.notify(err, 'warn', 'err' + err);
    if (!shift || type === 'wall') cancelPlace();
  }

  // ---------------- attack orders ----------------
  function setAmove(on) { amoveMode = on; canvas.style.cursor = on ? 'crosshair' : ''; if (on) UI.notify('Click the map to attack-move there (right click to cancel)', '', 'amove'); }
  function doAttackMove(sx, sy) {
    const g = screenToGround(sx, sy); setAmove(false); if (!g) return;
    const us = sel.filter(e => e.kind === 'unit' && e.owner === HUMAN && !e.dead && e.type !== 'villager');
    if (!us.length) return;
    formationMove(us.filter(u => u.type !== 'healer'), g.x, g.z, true);
    for (const h of us.filter(u => u.type === 'healer')) orderMove(h, g.x + rand(-1, 1), g.z + rand(-1, 1));
    View.showMoveMarker(g.x, g.z, 0xff5a4a); Sound.play('click');
  }
  // send an army against the nearest known enemy building (or the enemy's home if none seen)
  function charge(list) {
    const us = (list || sel).filter(e => e.kind === 'unit' && e.owner === HUMAN && !e.dead && !e.garrisonIn && (isMil(e) || e.type === 'healer'));
    if (!us.length) { UI.notify('Select soldiers first (press , for your army)', 'warn', 'charge'); return; }
    let ax = 0, az = 0; for (const u of us) { ax += u.x; az += u.z; } ax /= us.length; az /= us.length;
    let best = null, bd = Infinity;
    for (const b of buildings) { if (b.dead || b.owner !== AIP || !(b.seenBy0 || Game.reveal)) continue; const d = dist2(ax, az, b.x, b.z) + (b.type === 'wall' ? 900 : 0); if (d < bd) { bd = d; best = b; } }
    const tgt = best ? edgePoint(best, ax, az, 0.8) : { x: World.starts[AIP].x, z: World.starts[AIP].y };
    formationMove(us.filter(u => u.type !== 'healer'), tgt.x, tgt.z, true);
    for (const h of us.filter(u => u.type === 'healer')) orderMove(h, lerp(ax, tgt.x, 0.8), lerp(az, tgt.z, 0.8));
    View.showMoveMarker(tgt.x, tgt.z, 0xff5a4a); Sound.play('alarm'); UI.notify(best ? 'Charge! Attacking the ' + BUILDINGS[best.type].name : 'Charge! Marching on the enemy homeland', 'warn', 'charge');
    Minimap.ping(tgt.x, tgt.z);
  }
  function attackAll() { charge(units.filter(u => u.owner === HUMAN && !u.dead && !u.garrisonIn && (isMil(u) || u.type === 'healer') && (u.state === 'idle' || u.state === 'move'))); }
  // ---------------- control groups ----------------
  function setGroup(n, add) {
    const list = sel.filter(e => e.owner === HUMAN && !e.dead);
    if (!list.length) return;
    groups[n] = add ? Array.from(new Set([...(groups[n] || []), ...list.map(e => e.id)])) : list.map(e => e.id);
    UI.notify('Group ' + n + ' set (' + groups[n].length + ')', '', 'grp');
  }
  function recallGroup(n) {
    const list = (groups[n] || []).map(id => ents.get(id)).filter(e => e && !e.dead && !e.garrisonIn);
    if (!list.length) return;
    const now = performance.now();
    if (lastGroup.n === n && now - lastGroup.t < 400) { let x = 0, z = 0; for (const e of list) { x += e.x; z += e.z; } camJump(x / list.length, z / list.length); }
    lastGroup = { n, t: now };
    setSelection(list);
  }
  function selectIdle() {
    const idle = units.filter(u => u.owner === HUMAN && u.type === 'villager' && !u.dead && !u.garrisonIn && u.state === 'idle');
    if (!idle.length) { UI.notify('No idle villagers', '', 'idle'); return; }
    Input._idleI = ((Input._idleI || 0) + 1) % idle.length;
    const u = idle[Input._idleI]; setSelection([u]); camJump(u.x, u.z);
  }
  function selectArmy() {
    const list = units.filter(u => u.owner === HUMAN && (isMil(u) || u.type === 'healer') && !u.dead && !u.garrisonIn);
    setSelection(list); if (!list.length) UI.notify('You have no military units', '', 'army');
  }
  function centerSel() {
    if (!sel.length) { const tc = buildings.find(b => b.owner === HUMAN && b.type === 'towncenter' && !b.dead); if (tc) camJump(tc.x, tc.z); return; }
    let x = 0, z = 0; for (const e of sel) { x += e.x; z += e.z; } camJump(x / sel.length, z / sel.length);
  }
  function deleteSel() {
    const own = sel.filter(e => e.owner === HUMAN && !e.dead);
    for (const e of own) { if (e.kind === 'unit') killUnit(e, -1); else destroyBuilding(e, -1); }
    setSelection([]);
  }

  // ---------------- events ----------------
  function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
  function onKeyDown(e) {
    if (typing()) return;
    const k = e.key;
    keys[k.toLowerCase()] = true;
    Sound.init();
    if (Game.mode !== 'play') return;
    if (k === 'Escape' || k === 'p' || k === 'P' || k === 'F10') {
      if (amoveMode && k === 'Escape') { setAmove(false); return; }
      if (place && k === 'Escape') { cancelPlace(); return; }
      if (UI.subMenuOpen && k === 'Escape') { UI.closeSub(); return; }
      Game.togglePause(); e.preventDefault(); return;
    }
    if (Game.paused) return;
    if (/^[1-9]$/.test(k) || /^Digit[1-9]$/.test(e.code)) {
      const n = +(e.code ? e.code.replace('Digit', '') : k) || +k;
      if (e.ctrlKey || e.metaKey) { setGroup(n, false); e.preventDefault(); }
      else if (e.shiftKey) setGroup(n, true);
      else recallGroup(n);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'Delete' || k === 'Backspace') { deleteSel(); e.preventDefault(); return; }
    if (k === '.') { selectIdle(); return; }
    if (k === ',') { selectArmy(); return; }
    if (k === ' ') { centerSel(); e.preventDefault(); return; }
    if (k === 'Home') { setSelection([]); centerSel(); return; }
    if (k === 'PageUp') { View2.tilt(0.1); e.preventDefault(); return; }
    if (k === 'PageDown') { View2.tilt(-0.1); e.preventDefault(); return; }
    if (k === '+' || k === '=') { View2.zoom(0.85); return; }
    if (k === '-' || k === '_') { View2.zoom(1.18); return; }
    if (k === 'm' || k === 'M') { View2.overview(); return; }
    const up = k.toUpperCase();
    if (HOTKEYS.includes(up)) { if (UI.hotkey(up)) e.preventDefault(); }
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
  function pointerOnCanvas(e) { return e.target === canvas; }
  function onMouseDown(e) {
    Sound.init();
    if (!pointerOnCanvas(e)) return;
    canvas.focus();
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (Game.mode !== 'play' || Game.paused) return;
    if (e.button === 1) { mouse.rotating = true; mouse.rx = e.clientX; mouse.ry = e.clientY; e.preventDefault(); return; }
    if (e.button === 2) {
      if (amoveMode) { setAmove(false); return; }
      if (place) { if (place.wallStart) place.wallStart = null; else cancelPlace(); return; }
      contextAction(e.clientX, e.clientY); return;
    }
    if (e.button === 0 && e.altKey) { mouse.rotating = true; mouse.rx = e.clientX; mouse.ry = e.clientY; e.preventDefault(); return; }
    if (e.button === 0) {
      if (place) { doPlace(e.clientX, e.clientY, e.shiftKey); return; }
      if (amoveMode) { doAttackMove(e.clientX, e.clientY); return; }
      mouse.down = true; mouse.sx = e.clientX; mouse.sy = e.clientY;
    }
  }
  function onMouseMove(e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
    if (Game.mode === 'play' && !Game.paused && !mouse.down && !mouse.rotating && !place && !amoveMode && e.target === canvas) { const nt = performance.now(); if (nt - (mouse.hT || 0) > 90) { mouse.hT = nt; updateHover(e.clientX, e.clientY); } }
    else if (e.target !== canvas) hover = null;
    if (mouse.rotating) { Cam.tyaw -= (e.clientX - mouse.rx) * 0.008; View2.tilt((e.clientY - mouse.ry) * 0.006); mouse.rx = e.clientX; mouse.ry = e.clientY; return; }
    if (mouse.down) {
      const box = document.getElementById('selbox');
      if (Math.abs(e.clientX - mouse.sx) + Math.abs(e.clientY - mouse.sy) > 6) {
        box.classList.remove('hidden');
        box.style.left = Math.min(mouse.sx, e.clientX) + 'px'; box.style.top = Math.min(mouse.sy, e.clientY) + 'px';
        box.style.width = Math.abs(e.clientX - mouse.sx) + 'px'; box.style.height = Math.abs(e.clientY - mouse.sy) + 'px';
      }
    }
  }
  function onMouseUp(e) {
    if (mouse.rotating && (e.button === 1 || e.button === 0)) { mouse.rotating = false; return; }
    if (e.button !== 0 || !mouse.down) return;
    mouse.down = false;
    const box = document.getElementById('selbox'); box.classList.add('hidden');
    if (Game.mode !== 'play' || Game.paused) return;
    if (Math.abs(e.clientX - mouse.sx) + Math.abs(e.clientY - mouse.sy) > 6) boxSelect(mouse.sx, mouse.sy, e.clientX, e.clientY, e.shiftKey);
    else {
      const now = performance.now();
      const e0 = pickAt(e.clientX, e.clientY);
      const dbl = e0 && now - lastClick.t < 320 && lastClick.id === e0.id;
      lastClick = { t: now, id: e0 ? e0.id : 0 };
      clickSelect(e.clientX, e.clientY, e.shiftKey, dbl);
    }
  }
  function onWheel(e) {
    if (Game.mode !== 'play' || !pointerOnCanvas(e)) return;
    e.preventDefault();
    if (e.shiftKey) { View2.tilt(e.deltaY > 0 ? -0.06 : 0.06); return; }
    if (e.deltaY < 0 && Cam.tdist > 7) { const g = screenToGround(e.clientX, e.clientY); if (g) { Cam.x += (g.x - Cam.x) * 0.14; Cam.z += (g.z - Cam.z) * 0.14; } } // zoom toward the cursor
    Cam.tdist = clamp(Cam.tdist * (e.deltaY > 0 ? 1.12 : 0.89), 6, camMaxDist());
  }
  // ---------------- touch ----------------
  let tch = null;
  function tpos(t) { return { x: t.clientX, y: t.clientY }; }
  function onTouchStart(e) {
    Sound.init();
    if (!pointerOnCanvas(e) || Game.mode !== 'play' || Game.paused) return;
    e.preventDefault();
    const ts = e.touches;
    if (ts.length === 1) {
      const p0 = tpos(ts[0]);
      tch = { mode: 'one', sx: p0.x, sy: p0.y, x: p0.x, y: p0.y, moved: false, t: performance.now(), consumed: false };
      clearTimeout(tch.lp);
      tch.lp = setTimeout(() => { if (tch && !tch.moved && tch.mode === 'one') { tch.consumed = true; if (navigator.vibrate) navigator.vibrate(25); if (place) doPlace(tch.x, tch.y, false); else contextAction(tch.x, tch.y); } }, 480);
      mouse.x = p0.x; mouse.y = p0.y;
    } else if (ts.length === 2) {
      if (tch) clearTimeout(tch.lp);
      const a = tpos(ts[0]), b = tpos(ts[1]);
      tch = { mode: 'two', d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, consumed: true, moved: true };
    }
  }
  function onTouchMove(e) {
    if (!tch || Game.mode !== 'play') return;
    e.preventDefault();
    const ts = e.touches;
    if (tch.mode === 'one' && ts.length === 1) {
      const p0 = tpos(ts[0]);
      if (!tch.moved && Math.hypot(p0.x - tch.sx, p0.y - tch.sy) > 12) { tch.moved = true; clearTimeout(tch.lp); }
      if (tch.moved) {
        if (boxMode) {
          const box = document.getElementById('selbox'); box.classList.remove('hidden');
          box.style.left = Math.min(tch.sx, p0.x) + 'px'; box.style.top = Math.min(tch.sy, p0.y) + 'px'; box.style.width = Math.abs(p0.x - tch.sx) + 'px'; box.style.height = Math.abs(p0.y - tch.sy) + 'px';
        } else if (place) { mouse.x = p0.x; mouse.y = p0.y; }
        else {
          const dx = p0.x - tch.x, dy = p0.y - tch.y, k = Cam.dist * 0.0021;
          const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw), rx = Math.cos(Cam.yaw), rz = -Math.sin(Cam.yaw);
          Cam.x -= (rx * dx - fx * dy) * k; Cam.z -= (rz * dx - fz * dy) * k;
        }
      }
      tch.x = p0.x; tch.y = p0.y;
    } else if (tch.mode === 'two' && ts.length === 2) {
      const a = tpos(ts[0]), b = tpos(ts[1]);
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      Cam.tdist = clamp(Cam.tdist * tch.d / Math.max(10, d), 6, camMaxDist());
      let da = ang - tch.ang; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      Cam.tyaw += da; Cam.yaw += da;
      const dx = mx - tch.mx, dy = my - tch.my, k = Cam.dist * 0.0021;
      const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw), rx = Math.cos(Cam.yaw), rz = -Math.sin(Cam.yaw);
      Cam.x -= (rx * dx - fx * dy) * k; Cam.z -= (rz * dx - fz * dy) * k;
      tch.d = d; tch.ang = ang; tch.mx = mx; tch.my = my;
    }
  }
  function onTouchEnd(e) {
    if (!tch) return;
    if (e.touches.length > 0) { if (tch.mode === 'two' && e.touches.length === 1) { const p0 = tpos(e.touches[0]); tch = { mode: 'one', sx: p0.x, sy: p0.y, x: p0.x, y: p0.y, moved: true, consumed: true }; } return; }
    clearTimeout(tch.lp);
    const t = tch; tch = null;
    document.getElementById('selbox').classList.add('hidden');
    if (Game.mode !== 'play' || Game.paused) return;
    if (t.mode === 'one' && t.moved && boxMode && !t.consumed) { boxSelect(t.sx, t.sy, t.x, t.y, false); boxMode = false; UI.touchState(boxMode, actMode); return; }
    if (t.mode === 'one' && t.moved && place && !t.consumed) { mouse.x = t.x; mouse.y = t.y; updateGhost(); return; }
    if (t.consumed || t.moved) return;
    mouse.x = t.x; mouse.y = t.y;
    if (place) { updateGhost(); doPlace(t.x, t.y, false); return; }
    if (amoveMode) { doAttackMove(t.x, t.y); return; }
    if (actMode) { contextAction(t.x, t.y); actMode = false; UI.touchState(boxMode, actMode); return; }
    const now = performance.now();
    const e0 = pickAt(t.x, t.y);
    const dbl = e0 && now - lastClick.t < 350 && lastClick.id === e0.id;
    lastClick = { t: now, id: e0 ? e0.id : 0 };
    clickSelect(t.x, t.y, false, dbl);
  }

  function init() {
    canvas = document.getElementById('c');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.inside = false; });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseleave', () => { mouse.inside = false; });
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) mouse.inside = false; });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.getElementById('hud').addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    if (IS_TOUCH) document.body.classList.add('touch');
  }
  function update(dt) {
    if (Game.mode !== 'play') return;
    // pan
    let px = 0, pz = 0;
    if (keys['w'] || keys['arrowup']) pz -= 1;
    if (keys['s'] || keys['arrowdown']) pz += 1;
    if (keys['a'] || keys['arrowleft']) px -= 1;
    if (keys['d'] || keys['arrowright']) px += 1;
    if (Settings.edgeScroll && mouse.inside && !mouse.down && !IS_TOUCH && document.hasFocus()) {
      const m = 10;
      if (mouse.x <= m) px -= 1; else if (mouse.x >= innerWidth - m) px += 1;
      if (mouse.y <= m) pz -= 1; else if (mouse.y >= innerHeight - m) pz += 1;
    }
    if (px || pz) {
      const sp = (14 + Cam.dist * 0.9) * dt;
      const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw), rx = Math.cos(Cam.yaw), rz = -Math.sin(Cam.yaw);
      Cam.x += (rx * px - fx * pz) * sp; Cam.z += (rz * px - fz * pz) * sp;
    }
    if (keys['q']) Cam.tyaw += dt * 1.8;
    if (keys['e']) Cam.tyaw -= dt * 1.8;
    if (place) updateGhost();
    cleanSelection();
  }
  function reset() { sel = []; for (const k in groups) delete groups[k]; place = null; boxMode = false; actMode = false; amoveMode = false; hover = null; if (canvas) canvas.style.cursor = makeCursor('default'); View.clearGhost(); }
  return {
    init, update, reset, selection, setSelection, deselectEnt, contextAction, startPlace, cancelPlace, get placing() { return place; },
    get groups() { return groups; }, recallGroup, selectIdle, selectArmy, centerSel, deleteSel, screenToGround, project, pickAt, charge, attackAll, startAttackMove() { setAmove(true); },
    toggleBox() { boxMode = !boxMode; actMode = false; UI.touchState(boxMode, actMode); },
    toggleAct() { actMode = !actMode; boxMode = false; UI.touchState(boxMode, actMode); },
    get mouse() { return mouse; }, get hover() { return hover; },
  };
})();
