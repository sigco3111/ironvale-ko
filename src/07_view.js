// =====================================================================
//  VIEW — syncs simulation state to three.js (instancing, FX, icons)
// =====================================================================
const View = (() => {
  let UM = null;                 // unit models
  const UI_MESH = {};            // type -> {base, team, weapon, carry, meta}
  const CAP = 230;
  const m0 = new THREE.Matrix4(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), mr = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const piv = {}, pivInv = {};
  let rings, barBg, barFg, arrows, stones, moveMark, rallyFlag, bldSel, ghostGroup;
  const ghostPool = [];
  let markT = 0;
  const CH = {}, charMeshes = []; let teamRings = null;
  function ensureChar(name) {
    if (CH[name]) return CH[name];
    const ch = CHARS[name]; if (!ch) return null;
    const byGeo = new Map(), o = {};
    for (const st in ch.frames) o[st] = ch.frames[st].map(g => {
      let m = byGeo.get(g);
      if (!m) { m = new THREE.InstancedMesh(g, MAT.vc, CAP); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = Settings.quality !== 'low'; m.count = 0; m.visible = false; scene.add(m); byGeo.set(g, m); charMeshes.push(m); }
      return m;
    });
    return (CH[name] = o);
  }
  // seated pose for mounted riders: legs are spread to straddle the horse and the knees lifted
  function rideGeo(g) {
    const c = g.clone(), P = c.attributes.position; c.computeBoundingBox();
    const hip = c.boundingBox.max.y * 0.5;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y >= hip) continue; const t = (hip - y) / hip, x = P.getX(i); P.setX(i, x + clamp(x / 0.03, -1, 1) * t * 0.2); P.setZ(i, P.getZ(i) + t * t * 0.1); P.setY(i, y + t * 0.16); }
    P.needsUpdate = true; c.computeVertexNormals(); return c;
  }
  function ensureRider(name) {
    const key = 'ride:' + name; if (CH[key]) return CH[key];
    const ch = CHARS[name]; if (!ch) return null;
    const o = {};
    for (const st of ['idle', 'attack', 'death']) o[st] = (st === 'idle' ? [ch.frames.idle[0]] : ch.frames[st]).map(g => { const m = new THREE.InstancedMesh(rideGeo(g), MAT.vc, CAP); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = Settings.quality !== 'low'; m.count = 0; m.visible = false; scene.add(m); charMeshes.push(m); return m; });
    return (CH[key] = o);
  }
  function charModel(u) {
    if (u.charModel !== undefined) return u.charModel;
    const fc = players[u.owner] && players[u.owner].faction;
    let rl = fc && REALM_CHARS[fc] ? REALM_CHARS[fc][u.type] : null;
    if (u.owner === AIP && fc && fc === players[HUMAN].faction) rl = fc === 'crimson' ? null : CHAR_FOE[u.type];   // mirror match: keep the two sides apart
    const foe = rl ? rl.filter(hasModel) : [];
    const list = foe.length ? foe : (CHAR_FOR[u.type] || []).filter(hasModel);
    const name = list.length ? list[(u.id * 7 + 3) % list.length] : null;
    if (name && !ensureChar(name)) return (u.charModel = null);
    return (u.charModel = name);
  }

  function init() {
    UM = buildUnitModels();
    for (const type in UM) {
      const md = UM[type], o = { meta: md };
      const mk = (geo, mat, colored) => {
        if (!geo) return null;
        const m = new THREE.InstancedMesh(geo, mat, CAP);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false; m.castShadow = true;
        if (colored) for (let i = 0; i < CAP; i++) m.setColorAt(i, col.set(0xffffff));
        m.count = 0;
        scene.add(m); return m;
      };
      o.base = mk(md.base, MAT.vc); o.team = mk(md.team, MAT.inst, true); o.weapon = mk(md.weapon, MAT.vc);
      o.limbs = md.limbs.map(l => ({ mesh: mk(l.geo, MAT.vc), l, piv: new THREE.Matrix4().makeTranslation(l.pivot[0], l.pivot[1], l.pivot[2]), inv: new THREE.Matrix4().makeTranslation(-l.pivot[0], -l.pivot[1], -l.pivot[2]) }));
      o.carry = {}; for (const r in md.carry) o.carry[r] = mk(md.carry[r], MAT.vc);
      o.all = [o.base, o.team, o.weapon, ...o.limbs.map(x => x.mesh), ...Object.values(o.carry)].filter(Boolean);
      piv[type] = new THREE.Matrix4().makeTranslation(md.pivot[0], md.pivot[1], md.pivot[2]);
      pivInv[type] = new THREE.Matrix4().makeTranslation(-md.pivot[0], -md.pivot[1], -md.pivot[2]);
      UI_MESH[type] = o;
    }
    { const tg = new THREE.RingGeometry(0.2, 0.26, 24); tg.rotateX(-Math.PI / 2);
      teamRings = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }), 500);
      teamRings.frustumCulled = false; teamRings.renderOrder = 2; for (let i = 0; i < 500; i++) teamRings.setColorAt(i, col.set(0xffffff)); teamRings.count = 0; scene.add(teamRings); }
    // selection rings
    const rg = new THREE.RingGeometry(0.82, 1, 28); rg.rotateX(-Math.PI / 2);
    rings = new THREE.InstancedMesh(rg, MAT.ring, 400); rings.frustumCulled = false; rings.renderOrder = 3;
    for (let i = 0; i < 400; i++) rings.setColorAt(i, col.set(0xffffff));
    rings.count = 0;
    scene.add(rings);
    const pg = new THREE.PlaneGeometry(1, 1);
    barBg = new THREE.InstancedMesh(pg, MAT.bar, 400); barFg = new THREE.InstancedMesh(pg, MAT.bar.clone(), 400);
    for (const b of [barBg, barFg]) { b.frustumCulled = false; for (let i = 0; i < 400; i++) b.setColorAt(i, col.set(0x111111)); b.count = 0; scene.add(b); }
    barBg.renderOrder = 20; barFg.renderOrder = 21;
    // projectiles
    const ab = new MB(); ab.boxc(0.025, 0.025, 0.42, 0x6b4a2b, 0, 0, 0); ab.add(new THREE.ConeGeometry(0.03, 0.08, 4), 0x9aa3ad, 0, 0, 0.24, Math.PI / 2, 0, 0); ab.boxc(0.05, 0.01, 0.08, 0xeeeeee, 0, 0, -0.19);
    arrows = new THREE.InstancedMesh(CHARS.arrow ? CHARS.arrow.idle : ab.geo(), MAT.vc, 500); arrows.frustumCulled = false; arrows.count = 0; scene.add(arrows);
    const sb = new MB(); sb.dod(0.13, 0x777068, 0, 0, 0);
    stones = new THREE.InstancedMesh(sb.geo(), MAT.vc, 60); stones.frustumCulled = false; stones.count = 0; scene.add(stones);
    // markers
    const mg = new THREE.RingGeometry(0.3, 0.42, 24); mg.rotateX(-Math.PI / 2);
    moveMark = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: 0x8cff7a, transparent: true, depthWrite: false })); moveMark.visible = false; moveMark.renderOrder = 4; scene.add(moveMark);
    const fb = new MB(), ft = new MB(); fb.cyl(0.03, 0.03, 1.2, 0x5c3f24, 0, 0, 0, 5); ft.boxc(0.02, 0.28, 0.4, 0xffffff, 0, 1.0, 0.21);
    rallyFlag = new THREE.Group(); rallyFlag.add(new THREE.Mesh(fb.geo(), MAT.vc)); rallyFlag.add(new THREE.Mesh(ft.geo(), MAT.team[0])); rallyFlag.visible = false; scene.add(rallyFlag);
    const bg = new THREE.RingGeometry(0.96, 1.0, 4, 1); bg.rotateX(-Math.PI / 2); bg.rotateY(Math.PI / 4);
    bldSel = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0x9cff8a, transparent: true, opacity: 0.9, depthWrite: false })); bldSel.visible = false; bldSel.renderOrder = 3; scene.add(bldSel);
    ghostGroup = new THREE.Group(); scene.add(ghostGroup);
  }

  // ---------------- buildings ----------------
  function createBuildingMesh(b) {
    const g = new THREE.Group();
    g.position.set(b.x, b.y, b.z);
    g.rotation.y = b.owner === 1 ? Math.PI : 0;
    const inner = new THREE.Group(); g.add(inner);
    b.mesh = g; b.inner = inner;
    setBuildingModel(b, players[b.owner].age);
    if (!b.built) {
      const s = new THREE.Mesh(scaffoldGeo(b.size), MAT.vc); s.castShadow = true; g.add(s); b.scaf = s;
      inner.scale.y = 0.05;
    }
    scene.add(g);
  }
  function setBuildingModel(b, age) {
    const inner = b.inner; while (inner.children.length) inner.remove(inner.children[0]);
    const md = buildingModel(b.type, age, b.variant || 0, players[b.owner] && players[b.owner].faction);
    const base = new THREE.Mesh(md.base, MAT.vc); base.castShadow = true; base.receiveShadow = true; inner.add(base);
    if (md.team) { const t = new THREE.Mesh(md.team, MAT.team[b.owner]); t.castShadow = true; inner.add(t); }
    b.age = age;
  }
  function onBuildingComplete(b) {
    if (b.scaf) { b.mesh.remove(b.scaf); b.scaf = null; }
    if (b.inner) b.inner.scale.y = 1;
  }
  function onBuildingDestroyed(b, silent) {
    if (b.scaf) { b.mesh.remove(b.scaf); b.scaf = null; }
    if (silent && b.mesh) { scene.remove(b.mesh); b.mesh = null; }
  }
  function ageUpBuildings(owner) {
    const age = players[owner].age;
    for (const b of buildings) if (b.owner === owner && !b.dead && b.mesh && b.age !== age) setBuildingModel(b, age);
  }
  function removeBuildingMesh(b) { if (b.mesh) { scene.remove(b.mesh); b.mesh = null; } }

  // ---------------- per-frame sync ----------------
  function visibleToHuman(x, z) {
    if (Game.mode !== 'play' || Game.reveal) return true;
    return players[HUMAN].vis[idx(clamp(x | 0, 0, N - 1), clamp(z | 0, 0, N - 1))] === 1;
  }
  function exploredHuman(x, z) {
    if (Game.mode !== 'play' || Game.reveal) return true;
    return players[HUMAN].exp[idx(clamp(x | 0, 0, N - 1), clamp(z | 0, 0, N - 1))] === 1;
  }
  function sync(dt, time) {
    // units
    const counts = {};
    for (const t in UI_MESH) counts[t] = 0;
    for (const m of charMeshes) m.count = 0;
    let nTeam = 0;
    for (const u of units) {
      if (u.garrisonIn) continue;
      if (u.owner !== HUMAN && !visibleToHuman(u.x, u.z)) continue;
      const cmName = charModel(u);
      if (cmName) { drawChar(u, cmName); if (!u.dead && nTeam < 500) { p.set(u.x, heightAt(u.x, u.z) + 0.03, u.z); sc.set(1.05, 1, 1.05); m0.compose(p, q.identity(), sc); teamRings.setMatrixAt(nTeam, m0); teamRings.setColorAt(nTeam++, TEAM_LIN[u.owner]); } }
      const o = UI_MESH[u.type]; if (!o) continue; const i = counts[u.type]; if (i >= CAP) continue;
      const md = o.meta;
      if (cmName) {
        // only the carried load is still drawn procedurally
        if (u.type === 'villager') {
          counts[u.type]++; m1.makeScale(0, 0, 0);
          for (const mm of [o.base, o.team, o.weapon, ...o.limbs.map(l => l.mesh)]) if (mm) mm.setMatrixAt(i, m1);
          e.set(0, u.facing, 0); q.setFromEuler(e); p.set(u.x, heightAt(u.x, u.z) + (u.moving ? Math.abs(Math.sin(u.walk)) * 0.03 : 0), u.z); sc.set(1.15, 1.15, 1.15); m0.compose(p, q, sc);
          for (const r in o.carry) { if (u.carry > 0.5 && !u.dead && u.carryType === r) o.carry[r].setMatrixAt(i, m0); else o.carry[r].setMatrixAt(i, m1); }
        }
        continue;
      }
      counts[u.type]++;
      let y = heightAt(u.x, u.z), tilt = 0, roll = 0, s = md.scale || 1;
      if (u.moving) y += Math.abs(Math.sin(u.walk)) * (md.cav ? 0.06 : 0.045);
      if (u.dead) {
        const t = u.dieT;
        roll = Math.min(1, t / 0.45) * (Math.PI / 2) * (u.id % 2 ? 1 : -1);
        if (md.cav || isAnimal(u)) roll *= 0.95;
        if (u.type === 'ram' || u.type === 'catapult') { roll *= 0.25; }
        y -= Math.max(0, t - 1.0) * 0.45; s *= t > 1.6 ? Math.max(0.01, 1 - (t - 1.6) * 1.5) : 1;
      } else if (u.moving) tilt = Math.sin(u.walk * 2) * 0.03;
      e.set(tilt, u.facing, roll);
      q.setFromEuler(e); p.set(u.x, y, u.z); sc.set(s, s, s);
      m0.compose(p, q, sc);
      o.base.setMatrixAt(i, m0);
      if (o.team) { o.team.setMatrixAt(i, m0); o.team.setColorAt(i, TEAM_LIN[u.owner]); }
      if (o.weapon) {
        let a = 0, push = 0;
        const sw = u.swing;
        if (u.working && u.type === 'villager') a = -0.9 + Math.abs(Math.sin(u.work * 5.5)) * -0.0 + Math.sin(u.work * 5.5) * 0.9;
        else if (sw > 0) {
          const ph = 1 - sw;
          if (md.anim === 'swing') a = ph < 0.35 ? -ph / 0.35 * 1.7 : -1.7 + (ph - 0.35) / 0.65 * 2.2;
          else if (md.anim === 'thrust') a = Math.sin(ph * Math.PI) * 0.9;
          else if (md.anim === 'bow') a = -Math.sin(ph * Math.PI) * 0.25;
          else if (md.anim === 'cata') a = ph < 0.25 ? -ph / 0.25 * 2.2 : -2.2 + (ph - 0.25) / 0.75 * 2.2;
          else if (md.anim === 'ram') push = Math.sin(ph * Math.PI) * 0.3;
          if (sw > 0.95 && u.type === 'villager') a = 0;
        } else if (u.moving && md.armSwing && !md.cav) a = -Math.sin(u.walk) * 0.4;
        if (md.anim === 'ram') { m1.makeTranslation(0, 0, push); m2.multiplyMatrices(m0, m1); }
        else { mr.makeRotationX(a); m2.multiplyMatrices(m0, piv[u.type]); m2.multiply(mr); m2.multiply(pivInv[u.type]); }
        o.weapon.setMatrixAt(i, m2);
      }
      for (const L of o.limbs) {
        let a = 0;
        if (L.l.kind === 'spin') a = -u.walk * 0.55;
        else if (u.moving && !u.dead) a = Math.sin(u.walk + L.l.phase) * L.l.amp;
        mr.makeRotationX(a); m2.multiplyMatrices(m0, L.piv); m2.multiply(mr); m2.multiply(L.inv);
        L.mesh.setMatrixAt(i, m2);
      }
      for (const r in o.carry) {
        if (u.carry > 0.5 && !u.dead && u.carryType === r) o.carry[r].setMatrixAt(i, m0);
        else { m1.makeScale(0, 0, 0); o.carry[r].setMatrixAt(i, m1); }
      }
    }
    for (const m of charMeshes) { m.visible = m.count > 0; if (m.visible) m.instanceMatrix.needsUpdate = true; }
    if (teamRings) { teamRings.count = nTeam; teamRings.instanceMatrix.needsUpdate = true; if (teamRings.instanceColor) teamRings.instanceColor.needsUpdate = true; }
    for (const t in UI_MESH) {
      const o = UI_MESH[t]; const n = counts[t];
      for (const m of o.all) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    // buildings
    for (const b of buildings) {
      if (!b.mesh) continue;
      let vis = true;
      if (b.owner !== HUMAN && Game.mode === 'play' && !Game.reveal) vis = b.seenBy0 || exploredHuman(b.x, b.z) && (b.seenBy0 = visibleToHuman(b.x, b.z)) || false;
      if (b.dead) {
        b.mesh.position.y = b.y - b.dieT * 0.9;
        b.mesh.rotation.z = Math.sin(b.dieT * 9) * 0.02 * Math.max(0, 1.5 - b.dieT);
        if (b.dieT < 1.5 && Math.random() < 0.3) PFX.dust(b.x, b.y + 0.2, b.z, 1, b.size * 0.45);
      } else if (!b.built) {
        b.inner.scale.y = 0.05 + 0.95 * b.progress;
      }
      b.mesh.visible = vis;
    }
    updateFalling(dt);
    // projectiles
    let na = 0, ns = 0;
    for (const pr of projectiles) {
      if (pr.t < 0) continue;
      const k = Math.min(1, pr.t / pr.dur);
      const x = lerp(pr.sx, pr.tx, k), z = lerp(pr.sz, pr.tz, k), y = lerp(pr.sy, pr.ty, k) + pr.arc * 4 * k * (1 - k);
      if (pr.kind === 'stone') { if (ns < 60) { m0.makeTranslation(x, y, z); stones.setMatrixAt(ns++, m0); } continue; }
      if (na >= 500) continue;
      const k2 = Math.min(1, k + 0.02);
      const x2 = lerp(pr.sx, pr.tx, k2), z2 = lerp(pr.sz, pr.tz, k2), y2 = lerp(pr.sy, pr.ty, k2) + pr.arc * 4 * k2 * (1 - k2);
      p.set(x2 - x, y2 - y, z2 - z); if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
      q.setFromUnitVectors(_zAxis, p);
      sc.set(pr.kind === 'spear' ? 1.6 : 1, 1, pr.kind === 'spear' ? 1.8 : 1);
      p.set(x, y, z); m0.compose(p, q, sc); arrows.setMatrixAt(na++, m0);
    }
    arrows.count = na; stones.count = ns; arrows.instanceMatrix.needsUpdate = true; stones.instanceMatrix.needsUpdate = true;
    // move marker
    if (markT > 0) { markT -= dt; moveMark.visible = true; const s2 = 0.6 + markT * 1.4; moveMark.scale.set(s2, 1, s2); moveMark.material.opacity = Math.min(1, markT * 2); } else moveMark.visible = false;
    syncSelection();
  }
  function drawChar(u, name) {
    const ch = CHARS[name], o = CH[name];
    let st = 'idle', ph = 0, tilt = 0, roll = 0, y = heightAt(u.x, u.z), s = (MODEL_SCALE[name] || 1) * (UNIT_SCALE[u.type] || 1);
    if (u.dead) { st = 'death'; ph = Math.min(0.999, u.dieT / 1.1); if (u.dieT > 1.3) y -= (u.dieT - 1.3) * 0.5; if (u.dieT > 1.6) s = Math.max(0.01, 1 - (u.dieT - 1.6) * 1.5); }
    else if (u.swing > 0 && !u.working) { st = 'attack'; ph = 1 - u.swing; }
    else if (u.working) { st = 'work'; ph = (u.work * 0.85) % 1; }
    else if (u.moving) {
      const fast = (u.fleeT > 0 || RIDER[u.type] || (isAnimal(u) && u.state === 'attack')) && o.run && o.run.length > 1;
      st = fast ? 'run' : 'walk'; ph = ((u.walk / (Math.PI * 2) * (fast ? 0.6 : 1)) % 1 + 1) % 1;
    }
    else if (isAnimal(u) && o.work && o.work.length > 1 && ((u.id + Math.floor(U.uTime.value / 6)) % 3 === 0)) { st = 'work'; ph = (U.uTime.value * 0.22 + u.id * 0.1) % 1; }
    else { st = 'idle'; ph = ((U.uTime.value * 0.3 + u.id * 0.37) % 1); }
    // procedural layer on top of the baked clips: attack lunge, hit flinch, lean into movement, breathing
    const lg = st === 'attack' && !u.dead ? Math.sin(ph * Math.PI) * 0.16 : 0, ox = Math.sin(u.facing) * lg, oz = Math.cos(u.facing) * lg;
    if (!u.dead) {
      if (u.hitT > 0) { tilt -= u.hitT * 1.3; y += u.hitT * 0.12; }
      if (st === 'walk') tilt += 0.05; else if (st === 'run') tilt += 0.1;
      if (st === 'idle') s *= 1 + Math.sin(U.uTime.value * 2.1 + u.id) * 0.012;
    }
    if (!ch.animated || !(o[st] && o[st].length > 1) && st !== 'idle') {
      // static model (or missing clip): procedural waddle / lean so it still feels alive
      if (u.dead) roll = Math.min(1, u.dieT / 0.45) * (Math.PI / 2) * (u.id % 2 ? 1 : -1);
      else if (st === 'walk') { roll = Math.sin(u.walk) * 0.1; y += Math.abs(Math.sin(u.walk)) * 0.05; }
      else if (st === 'attack') tilt = Math.sin(ph * Math.PI) * 0.25;
      else if (st === 'work') tilt = Math.abs(Math.sin(u.work * 5)) * 0.35;
      if (!ch.animated || !(o[st] && o[st].length > 1)) { st = 'idle'; ph = 0; }
    }
    const fr = o[st] || o.idle;
    const m = fr[Math.min(fr.length - 1, (ph * fr.length) | 0)];
    if (m.count >= CAP) return;
    const rd = RIDER[u.type];
    if (rd) {
      const ro = ensureRider(rd.model);
      if (ro) {
        const rst = u.dead ? 'death' : (u.swing > 0 ? 'attack' : 'idle'), rph = u.dead ? ph : u.swing > 0 ? 1 - u.swing : 0;
        const rf = ro[rst] || ro.idle, rm = rf[Math.min(rf.length - 1, (rph * rf.length) | 0)];
        if (rm.count < CAP) {
          e.set(tilt, u.facing, roll); q.setFromEuler(e);
          const bob = u.moving ? Math.abs(Math.sin(u.walk * 1.5)) * 0.05 : 0;
          const hs = s / (MODEL_SCALE[name] || 1);
          p.set(u.x + ox + Math.sin(u.facing) * rd.z, y + (rd.y + bob) * hs, u.z + oz + Math.cos(u.facing) * rd.z); sc.set(rd.s * hs, rd.s * hs, rd.s * hs);
          m0.compose(p, q, sc); rm.setMatrixAt(rm.count++, m0);
        }
      }
    }
    e.set(tilt, u.facing + (MODEL_YAW[name] || 0), roll); q.setFromEuler(e); p.set(u.x + ox, y, u.z + oz); sc.set(s, s, s);
    m0.compose(p, q, sc); m.setMatrixAt(m.count++, m0);
  }
  const _zAxis = new THREE.Vector3(0, 0, 1);
  const TEAM_LIN = TEAM_COL.map(h => lin(h));
  const falling = [];
  function addFalling(r) { r.fall = 0; falling.push(r); }
  function updateFalling(dt) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const r = falling[i];
      if (r.dead) { falling.splice(i, 1); continue; }
      const prev = r.fall; r.fall = Math.min(1, r.fall + dt * (0.6 + r.fall * 2.2));
      setResInstance(r, true);
      if (r.fall >= 1) { falling.splice(i, 1); if (prev < 1) { const h = heightAt(r.x, r.z); PFX.dust(r.x + Math.sin(r.fallDir) * 0.8, h + 0.1, r.z + Math.cos(r.fallDir) * 0.8, 6, 0.5); for (let k = 0; k < 6; k++) PFX.leaf(r.x + Math.sin(r.fallDir) * rand(0.4, 1.2), h + 0.4, r.z + Math.cos(r.fallDir) * rand(0.4, 1.2)); } }
    }
  }
  function syncSelection() {
    const sel = Input.selection();
    let nr = 0, nb = 0;
    const camQ = camera.quaternion;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
    const addBar = (x, y, z, w, frac, colr) => {
      if (nb >= 400) return;
      p.set(x, y, z); sc.set(w, 0.09, 1); m0.compose(p, camQ, sc); barBg.setMatrixAt(nb, m0); barBg.setColorAt(nb, col.set(0x161616));
      const fw = Math.max(0.001, w * frac);
      p.set(x - right.x * (w - fw) / 2, y - right.y * (w - fw) / 2, z - right.z * (w - fw) / 2); sc.set(fw, 0.07, 1); m0.compose(p, camQ, sc);
      barFg.setMatrixAt(nb, m0); barFg.setColorAt(nb, col.set(colr)); nb++;
    };
    bldSel.visible = false; rallyFlag.visible = false;
    for (const ent of sel) {
      if (ent.dead) continue;
      const own = ent.owner === HUMAN, c = own ? 0x9cff8a : ent.owner === GAIA || ent.kind === 'resource' ? 0xf2e08a : 0xff6a5a;
      if (ent.kind === 'unit') {
        if (ent.garrisonIn) continue;
        if (nr < 400) { const r = UNITS[ent.type].radius * 1.5; p.set(ent.x, heightAt(ent.x, ent.z) + 0.04, ent.z); sc.set(r, 1, r); m0.compose(p, q.identity(), sc); rings.setMatrixAt(nr, m0); rings.setColorAt(nr, col.set(c)); nr++; }
        const fr = ent.hp / ent.maxHp;
        addBar(ent.x, heightAt(ent.x, ent.z) + (UNITS[ent.type].cls === 'cavalry' ? 1.6 : ent.type === 'ram' || ent.type === 'catapult' ? 1.3 : 1.15), ent.z, 0.6, fr, fr > 0.5 ? 0x5fd35a : fr > 0.25 ? 0xe8c547 : 0xe0483a);
      } else {
        const s = ent.size * 0.72;
        bldSel.visible = true; bldSel.position.set(ent.x, (ent.kind === 'building' ? ent.y : heightAt(ent.x, ent.z)) + 0.2, ent.z); bldSel.scale.set(s, 1, s); bldSel.material.color.set(c);
        if (ent.kind === 'building') {
          const fr = ent.hp / ent.maxHp;
          addBar(ent.x, ent.y + (ent.size >= 3 ? 3.4 : 2.2) + (ent.type === 'tower' ? 1.4 : 0) + (ent.type === 'wonder' ? 2.6 : 0), ent.z, Math.min(2.4, ent.size * 0.6), fr, fr > 0.5 ? 0x5fd35a : fr > 0.25 ? 0xe8c547 : 0xe0483a);
          if (own && ent.rally && sel.length === 1) { rallyFlag.visible = true; rallyFlag.position.set(ent.rally.x, heightAt(ent.rally.x, ent.rally.z), ent.rally.z); }
        }
      }
    }
    // buildings: construction progress, damage, and gold pips for upgrade levels
    for (const b of buildings) {
      if (nb >= 370) break;
      if (b.dead || !b.mesh || !b.mesh.visible || b.type === 'wall' || b.type === 'farm' || sel.includes(b)) continue;
      if (Math.abs(b.x - Cam.x) > 55 || Math.abs(b.z - Cam.z) > 55) continue;
      const top = b.y + (b.size >= 3 ? 3.3 : 2.2) + (b.type === 'tower' ? 1.4 : 0) + (b.type === 'wonder' ? 2.6 : 0), bw = Math.min(2, b.size * 0.55);
      if (!b.built) addBar(b.x, top, b.z, bw, Math.max(0.03, b.progress), 0xf0d48a);
      else if (b.hp < b.maxHp * 0.995) { const fr = b.hp / b.maxHp; addBar(b.x, top, b.z, bw, fr, fr > 0.5 ? 0x5fd35a : fr > 0.25 ? 0xe8c547 : 0xe0483a); }
      const L = b.level || 1; for (let k = 0; k < L - 1; k++) { const o = (k - (L - 2) / 2) * 0.24; addBar(b.x + right.x * o, top + 0.24, b.z + right.z * o, 0.15, 1, 0xf3c969); }
    }
    // damaged own/visible units always show a thin bar
    for (const u of units) {
      if (nb >= 400) break;
      if (u.dead || u.garrisonIn || u.hp >= u.maxHp || (isAnimal(u) && u.type !== 'bull') || sel.includes(u)) continue;
      if (u.owner !== HUMAN && !visibleToHuman(u.x, u.z)) continue;
      const fr = u.hp / u.maxHp;
      addBar(u.x, heightAt(u.x, u.z) + (UNITS[u.type].cls === 'cavalry' ? 1.6 : 1.15), u.z, 0.5, fr, u.owner === HUMAN ? 0x5fd35a : 0xe0483a);
    }
    const hv = Input.hover;
    if (hv && Game.mode === 'play' && !hv.dead && ents.has(hv.id) && !sel.includes(hv)) {
      if (hv.kind === 'unit') { if (!hv.garrisonIn && nr < 400) { const r = UNITS[hv.type].radius * 1.7; p.set(hv.x, heightAt(hv.x, hv.z) + 0.05, hv.z); sc.set(r, 1, r); m0.compose(p, q.identity(), sc); rings.setMatrixAt(nr, m0); rings.setColorAt(nr, col.set(0xffffff)); nr++; } }
      else if (!bldSel.visible) { const s2 = hv.size * 0.74; bldSel.visible = true; bldSel.position.set(hv.x, (hv.kind === 'building' ? hv.y : heightAt(hv.x, hv.z)) + 0.2, hv.z); bldSel.scale.set(s2, 1, s2); bldSel.material.color.set(0xffffff); }
    }
    rings.count = nr; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    barBg.count = nb; barFg.count = nb;
    for (const b of [barBg, barFg]) { b.instanceMatrix.needsUpdate = true; if (b.instanceColor) b.instanceColor.needsUpdate = true; }
  }
  function showMoveMarker(x, z, colr = 0x8cff7a) { moveMark.position.set(x, heightAt(x, z) + 0.06, z); moveMark.material.color.set(colr); markT = 0.6; }

  // ---------------- placement ghost ----------------
  function ghost(list) { // list: [{type, tx, ty, ok}]
    while (ghostPool.length < list.length) {
      const g = new THREE.Group(); const m = new THREE.Mesh(undefined, MAT.ghostOk); m.renderOrder = 8; g.add(m);
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), MAT.ghostOk); fp.renderOrder = 7; g.add(fp);
      ghostGroup.add(g); ghostPool.push(g);
    }
    ghostPool.forEach((g, i) => {
      const it = list[i];
      if (!it) { g.visible = false; return; }
      g.visible = true;
      const s = BUILDINGS[it.type].size, md = buildingModel(it.type, players[HUMAN].age, 0, players[HUMAN].faction);
      const m = g.children[0], fp = g.children[1];
      m.geometry = md.base; m.material = it.ok ? MAT.ghostOk : MAT.ghostBad;
      fp.material = m.material; fp.scale.set(s, 1, s); fp.position.y = 0.06;
      const cx = it.tx + s / 2, cz = it.ty + s / 2;
      let h = 0, n = 0; for (let y = it.ty; y <= it.ty + s; y++) for (let x = it.tx; x <= it.tx + s; x++) { if (x >= 0 && y >= 0 && x <= N && y <= N) { h += World.vh[y * (N + 1) + x]; n++; } }
      g.position.set(cx, n ? h / n : 0, cz);
    });
  }
  function clearGhost() { for (const g of ghostPool) g.visible = false; }

  // ---------------- icons (render models to images) ----------------
  const ICONS = {};
  function renderIcons() {
    const size = 96;
    const rt = new THREE.WebGLRenderTarget(size, size); rt.texture.encoding = THREE.sRGBEncoding;
    const sc2 = new THREE.Scene();
    sc2.add(new THREE.HemisphereLight(0xffffff, 0x554433, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(3, 5, 4); sc2.add(dl);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const buf = new Uint8Array(size * size * 4);
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const cx = cv.getContext('2d');
    const prevFog = U.uFog.value; U.uFog.value = whiteTex;
    const prevClear = renderer.getClearColor(new THREE.Color()).getHex(), prevA = renderer.getClearAlpha();
    const snap = (objs, dist, ty, ang = 0.7) => {
      for (const o of objs) sc2.add(o);
      cam.position.set(Math.sin(ang) * dist, ty + dist * 0.55, Math.cos(ang) * dist); cam.lookAt(0, ty, 0);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(sc2, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      renderer.setRenderTarget(null);
      const img = cx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const si = ((size - 1 - y) * size + x) * 4, di = (y * size + x) * 4; img.data[di] = buf[si]; img.data[di + 1] = buf[si + 1]; img.data[di + 2] = buf[si + 2]; img.data[di + 3] = buf[si + 3]; }
      cx.clearRect(0, 0, size, size); cx.putImageData(img, 0, 0);
      for (const o of objs) sc2.remove(o);
      return cv.toDataURL();
    };
    for (const t in UM) {
      const cl = (CHAR_FOR[t] || []).filter(n => CHARS[n]);
      if (cl.length) { ICONS[t] = snap([new THREE.Mesh(CHARS[cl[0]].idle, MAT.vc)], 1.75, 0.5); continue; }
      const md = UM[t]; const objs = [];
      for (const k of ['base', 'weapon']) if (md[k]) objs.push(new THREE.Mesh(md[k], MAT.vc));
      for (const l of md.limbs) objs.push(new THREE.Mesh(l.geo, MAT.vc));
      if (md.team) objs.push(new THREE.Mesh(md.team, MAT.team[0]));
      const big = md.cav || t === 'ram' || t === 'catapult';
      ICONS[t] = snap(objs, big ? 2.6 : 1.9, big ? 0.55 : 0.42);
    }
    for (const t in CHAR_FOR) if (!ICONS[t] && CHARS[CHAR_FOR[t][0]]) { const g = CHARS[CHAR_FOR[t][0]].idle; g.computeBoundingBox(); const h = g.boundingBox.max.y; ICONS[t] = snap([new THREE.Mesh(g, MAT.vc)], 1.2 + h * 1.6, h * 0.5); }
    for (const t in BUILDINGS) {
      const md = buildingModel(t, t === 'castle' || t === 'wonder' || t === 'workshop' ? 2 : t === 'tower' || t === 'wall' || t === 'gate' || ['barracks', 'range', 'stable', 'blacksmith'].includes(t) ? 1 : 0);
      const objs = [new THREE.Mesh(md.base, MAT.vc)]; if (md.team) objs.push(new THREE.Mesh(md.team, MAT.team[0]));
      const s = BUILDINGS[t].size;
      ICONS['b_' + t] = snap(objs, 2.2 + s * 1.55 + (t === 'wonder' ? 1.5 : 0), t === 'tower' ? 1.4 : t === 'wonder' ? 2.0 : 0.5 + s * 0.12);
    }
    for (const k of ['gold', 'stone', 'berry', 'pine', 'oak', 'birch', 'carcass']) {
      const geos = k === 'pine' || k === 'oak' ? [RESGEO.trunk, RESGEO[k]] : [RESGEO[k]];
      ICONS['r_' + k] = snap(geos.map(g => new THREE.Mesh(g, MAT.vc)), k === 'carcass' ? 1.4 : 2.6, k === 'pine' || k === 'oak' ? 0.7 : 0.3);
    }
    for (const mm of ['meat_ham', 'meat_steak', 'meat_fish']) if (CHARS[mm]) ICONS['r_' + mm] = snap([new THREE.Mesh(CHARS[mm].idle, MAT.vc)], 1.5, 0.12);
    U.uFog.value = prevFog; renderer.setClearColor(prevClear, prevA);
    rt.dispose();
  }
  function resetFrame() { for (const t in UI_MESH) for (const m of UI_MESH[t].all) m.count = 0; for (const m of charMeshes) { m.count = 0; m.visible = false; } if (teamRings) teamRings.count = 0; falling.length = 0; arrows.count = 0; stones.count = 0; rings.count = 0; barBg.count = 0; barFg.count = 0; clearGhost(); }
  return { refreshBuilding(b) { setBuildingModel(b, players[b.owner].age); }, addFalling, init, createBuildingMesh, onBuildingComplete, onBuildingDestroyed, ageUpBuildings, removeBuildingMesh, sync, showMoveMarker, ghost, clearGhost, renderIcons, ICONS, resetFrame, visibleToHuman, exploredHuman };
})();
