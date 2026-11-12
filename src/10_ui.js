// =====================================================================
//  UI — HUD, command panel, tooltips, notifications, minimap, menus
// =====================================================================
const $ = id => document.getElementById(id);
const GLYPH = {};
function glyph(name) {
  if (GLYPH[name]) return GLYPH[name];
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  const gr = g.createRadialGradient(48, 40, 6, 48, 48, 60); gr.addColorStop(0, '#3a4256'); gr.addColorStop(1, '#14171f');
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  g.strokeStyle = '#f3c969'; g.fillStyle = '#f3c969'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  const P = (pts, fill) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); if (fill) { g.closePath(); g.fill(); } else g.stroke(); };
  const sword = (x, y, s, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.fillStyle = '#dfe6ee'; P([-4, -34, 4, -34, 4, 10, -4, 10], 1); P([-4, -34, 0, -42, 4, -34], 1); g.fillStyle = '#c9a24a'; P([-14, 10, 14, 10, 14, 16, -14, 16], 1); P([-3, 16, 3, 16, 3, 30, -3, 30], 1); g.restore(); };
  const shield = (lvl) => { g.fillStyle = '#5b7fc8'; P([48, 16, 74, 24, 72, 52, 48, 80, 24, 52, 22, 24], 1); g.strokeStyle = '#f3c969'; g.lineWidth = 5; P([48, 16, 74, 24, 72, 52, 48, 80, 24, 52, 22, 24, 48, 16]); g.fillStyle = '#f3c969'; for (let i = 0; i < lvl; i++) g.fillRect(36 + i * 9 - (lvl - 1) * 4.5 + 4, 40, 6, 14); };
  const arrow = (n) => { for (let i = 0; i < n; i++) { const o = i * 14 - (n - 1) * 7; g.strokeStyle = '#e8dcc0'; g.lineWidth = 5; P([20 + o, 76, 72 + o, 24]); g.fillStyle = '#dfe6ee'; P([72 + o, 24, 58 + o, 28, 68 + o, 38], 1); g.strokeStyle = '#d0453a'; g.lineWidth = 4; P([24 + o, 80, 18 + o, 70]); P([28 + o, 76, 22 + o, 66]); } };
  switch (name) {
    case 'age': P([48, 14, 76, 44, 60, 44, 60, 80, 36, 80, 36, 44, 20, 44], 1); break;
    case 'age2': P([18, 70, 22, 30, 36, 50, 48, 22, 60, 50, 74, 30, 78, 70], 1); g.fillRect(18, 72, 60, 8); break;
    case 'loom': g.fillStyle = '#b07a45'; g.fillRect(28, 20, 40, 10); g.fillRect(28, 66, 40, 10); g.fillStyle = '#e8e0c8'; g.fillRect(34, 30, 28, 36); g.strokeStyle = '#c9a24a'; g.lineWidth = 3; for (let i = 0; i < 6; i++) P([34, 34 + i * 6, 62, 32 + i * 6]); break;
    case 'wheel': g.lineWidth = 6; g.beginPath(); g.arc(48, 48, 28, 0, 7); g.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; P([48 + Math.cos(a) * 28, 48 + Math.sin(a) * 28, 48 - Math.cos(a) * 28, 48 - Math.sin(a) * 28]); } break;
    case 'axe': g.strokeStyle = '#b07a45'; g.lineWidth = 7; P([30, 80, 62, 22]); g.fillStyle = '#dfe6ee'; P([52, 20, 76, 26, 70, 46, 58, 40], 1); P([56, 30, 40, 20, 38, 36, 52, 40], 1); break;
    case 'saw': g.fillStyle = '#dfe6ee'; P([16, 40, 80, 40, 80, 54, 16, 54], 1); for (let i = 0; i < 8; i++) P([18 + i * 8, 54, 22 + i * 8, 62, 26 + i * 8, 54], 1); g.strokeStyle = '#b07a45'; g.lineWidth = 6; P([16, 30, 16, 64]); P([80, 30, 80, 64]); P([16, 30, 80, 30]); break;
    case 'pick': case 'pick2': g.strokeStyle = '#b07a45'; g.lineWidth = 7; P([30, 82, 60, 26]); g.strokeStyle = name === 'pick' ? '#f4c430' : '#c0c4cc'; g.lineWidth = 7; g.beginPath(); g.arc(58, 44, 30, -2.4, -0.5); g.stroke(); break;
    case 'plow': g.strokeStyle = '#c9a24a'; for (let i = 0; i < 4; i++) P([18, 34 + i * 12, 78, 30 + i * 12]); g.fillStyle = '#9bb446'; for (let i = 0; i < 5; i++) P([24 + i * 12, 28, 30 + i * 12, 16, 36 + i * 12, 28], 1); break;
    case 'sword': sword(48, 52, 1.05, 0.7); break;
    case 'sword2': sword(40, 52, 0.95, 0.6); sword(58, 52, 0.95, -0.6); break;
    case 'shield': shield(1); break; case 'shield2': shield(1); g.fillStyle = '#d0453a'; g.fillRect(44, 60, 8, 8); break;
    case 'shield3': shield(2); break; case 'shield4': shield(2); g.fillStyle = '#d0453a'; g.fillRect(44, 62, 8, 8); break;
    case 'arrow': arrow(1); break; case 'arrow2': arrow(2); break;
    case 'stop': g.fillStyle = '#d0453a'; P([34, 18, 62, 18, 78, 34, 78, 62, 62, 78, 34, 78, 18, 62, 18, 34], 1); g.fillStyle = '#fff'; g.fillRect(30, 44, 36, 8); break;
    case 'del': g.strokeStyle = '#ec5a4a'; g.lineWidth = 10; P([26, 26, 70, 70]); P([70, 26, 26, 70]); break;
    case 'out': g.strokeStyle = '#c9a24a'; P([22, 80, 22, 24, 50, 14, 50, 80]); g.strokeStyle = '#f3c969'; P([42, 48, 80, 48]); P([68, 36, 80, 48, 68, 60]); break;
    case 'back': P([60, 20, 30, 48, 60, 76]); break;
    case 'food': case 'wood': case 'stone': case 'gold': case 'pop': return resIcon(name);
  }
  return (GLYPH[name] = c.toDataURL());
}
function resIcon(r) {
  const key = 'res_' + r; if (GLYPH[key]) return GLYPH[key];
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
  const circ = (x, y, rad, col, st) => { g.beginPath(); g.arc(x, y, rad, 0, 7); g.fillStyle = col; g.fill(); if (st) { g.strokeStyle = st; g.lineWidth = 2; g.stroke(); } };
  if (r === 'food') { g.fillStyle = '#4a8a3c'; g.beginPath(); g.ellipse(26, 12, 10, 5, -0.5, 0, 7); g.fill(); circ(16, 28, 10, '#d8453a', '#7a1a14'); circ(31, 30, 10, '#e0574a', '#7a1a14'); circ(24, 38, 8, '#c93a30', '#7a1a14'); circ(13, 25, 3, 'rgba(255,255,255,.6)'); }
  else if (r === 'wood') { g.fillStyle = '#8a5a2b'; g.fillRect(6, 26, 36, 12); g.fillRect(10, 12, 32, 12); for (const [x, y] of [[8, 32], [12, 18]]) { circ(x, y, 6, '#d9b07a', '#6b4a2b'); circ(x, y, 2.5, '#a8784a'); } }
  else if (r === 'stone') { g.fillStyle = '#9a9a9e'; g.beginPath(); g.moveTo(6, 40); g.lineTo(12, 20); g.lineTo(26, 12); g.lineTo(38, 18); g.lineTo(44, 40); g.closePath(); g.fill(); g.strokeStyle = '#5c5c60'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#c4c4c8'; g.beginPath(); g.moveTo(14, 22); g.lineTo(26, 15); g.lineTo(24, 28); g.closePath(); g.fill(); }
  else if (r === 'gold') { for (const [x, y, s] of [[14, 32, 10], [32, 30, 11], [23, 18, 9]]) { g.fillStyle = '#f4c430'; g.beginPath(); g.moveTo(x - s, y + 4); g.lineTo(x - s * 0.4, y - s * 0.8); g.lineTo(x + s * 0.6, y - s * 0.7); g.lineTo(x + s, y + 3); g.lineTo(x, y + s * 0.8); g.closePath(); g.fill(); g.strokeStyle = '#9a6a10'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff3b0'; g.fillRect(x - 3, y - 4, 4, 3); } }
  else if (r === 'pop') { circ(24, 13, 8, '#e8dcc0'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(10, 44); g.quadraticCurveTo(10, 23, 24, 23); g.quadraticCurveTo(38, 23, 38, 44); g.closePath(); g.fill(); }
  return (GLYPH[key] = c.toDataURL());
}

const UI = (() => {
  let cmds = [], cmdSig = '', infoSig = '', selDirty = true, tick = 0;
  const btnEls = [];
  let tipFor = null;
  const noteKeys = {};
  let subStack = [];

  function init() {
    for (const r of [...RESN, 'pop']) $('r-' + r).querySelector('i').style.backgroundImage = `url(${resIcon(r)})`;
    const grid = $('cmds');
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('button'); b.className = 'cb empty'; b.innerHTML = '<span class="hk"></span><span class="ct"></span>';
      b.addEventListener('click', e => { e.stopPropagation(); Sound.init(); trigger(i); });
      b.addEventListener('mouseenter', () => showTip(i, b));
      b.addEventListener('mouseleave', hideTip);
      b.addEventListener('touchstart', () => showTip(i, b), { passive: true });
      b.addEventListener('touchend', () => setTimeout(hideTip, 900), { passive: true });
      grid.appendChild(b); btnEls.push(b);
    }
    $('btnPause').onclick = () => Game.togglePause();
    $('btnAttack').onclick = () => { Sound.init(); Input.attackAll(); };
    $('btnIdle').onclick = () => { Sound.init(); Input.selectIdle(); };
    $('btnArmy').onclick = () => { Sound.init(); Input.selectArmy(); Input.centerSel(); };
    // ---- camera panel: drag dial, hold-to-repeat buttons, one-click presets ----
    const hold = (id, fn) => { const el = $(id); let tm = null; const stop = () => { clearInterval(tm); tm = null; };
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); fn(); stop(); tm = setInterval(fn, 45); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, stop); };
    hold('vIn', () => View2.zoom(0.96)); hold('vOut', () => View2.zoom(1.04));
    hold('vRotL', () => View2.rotate(0.05)); hold('vRotR', () => View2.rotate(-0.05));
    const tap = (id, fn) => { $(id).onclick = e => { e.stopPropagation(); Sound.init(); Sound.play('click'); fn(); }; };
    tap('vNear', () => View2.preset(11)); tap('vMid', () => View2.preset(26)); tap('vFar', () => View2.preset(58));
    tap('vTop', () => View2.top()); tap('vMap', () => View2.overview()); tap('vHome', () => View2.reset());
    tap('vSun', () => Atmos.cycleTime()); tap('vWx', () => Atmos.cycleWeather());
    tap('vHide', () => { $('viewctl').classList.toggle('min'); $('vHide').textContent = $('viewctl').classList.contains('min') ? '+' : '–'; });
    const dial = $('vdial'); let dd = null;
    dial.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dial.setPointerCapture(e.pointerId); dd = { x: e.clientX, y: e.clientY }; dial.classList.add('on'); });
    dial.addEventListener('pointermove', e => { if (!dd) return; View2.rotate(-(e.clientX - dd.x) * 0.012); View2.tilt((e.clientY - dd.y) * 0.008); dd = { x: e.clientX, y: e.clientY }; });
    for (const ev of ['pointerup', 'pointercancel']) dial.addEventListener(ev, () => { dd = null; dial.classList.remove('on'); });
    const autoBtn = $('btnAuto');
    const syncAuto = () => { autoBtn.classList.toggle('on', Settings.autoWork); autoBtn.textContent = 'AUTO-WORK ' + (Settings.autoWork ? 'ON' : 'OFF'); };
    autoBtn.onclick = () => { Settings.autoWork = !Settings.autoWork; saveSettings(); syncAuto(); Sound.play('click'); notify('Auto-work ' + (Settings.autoWork ? 'enabled: idle villagers gather, farm and build houses automatically' : 'disabled'), '', 'auto'); };
    syncAuto();
    $('tbBox').onclick = () => Input.toggleBox();
    $('tbAct').onclick = () => Input.toggleAct();
    $('tbIdle').onclick = () => Input.selectIdle();
    $('tbArmy').onclick = () => Input.selectArmy();
    $('tbDesel').onclick = () => { Input.setSelection([]); Input.cancelPlace(); };
    $('tbRotL').onclick = () => Input.attackAll();
    $('tbRotR').onclick = () => View2.overview();
    for (const r of RESN) $('r-' + r).title = r[0].toUpperCase() + r.slice(1);
    $('r-pop').title = 'Population / capacity (max 100)';
    Minimap.init();
    Menus.init();
  }
  function touchState(box, act) { $('tbBox').classList.toggle('on', box); $('tbAct').classList.toggle('on', act); }

  // ---------------- notifications ----------------
  function notify(text, cls = '', key) {
    if (Game.mode !== 'play') return;
    const k = key || text, now = performance.now();
    if (noteKeys[k] && now - noteKeys[k] < 3500) return;
    noteKeys[k] = now;
    const box = $('notes');
    const el = document.createElement('div'); el.className = 'note ' + cls; el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    const life = cls === 'story' ? 7000 : 2800;
    setTimeout(() => el.classList.add('out'), life);
    setTimeout(() => el.remove(), life + 600);
  }
  const floats = [];
  function floatText(x, y, z, text, res) {
    if (floats.length > 30) { floats[0].el.remove(); floats.shift(); }
    const el = document.createElement('div'); el.className = 'ft';
    el.innerHTML = (res ? `<i style="background-image:url(${resIcon(res)})"></i>` : '') + text;
    document.body.appendChild(el);
    floats.push({ el, x, y, z, t: 0 });
  }
  function frame(dt) {
    const nd = $('vneedle'); if (nd) nd.style.transform = 'rotate(' + (Cam.yaw - Math.PI * 1.25) + 'rad)';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt;
      if (f.t > 1.4) { f.el.remove(); floats.splice(i, 1); continue; }
      const s = Input.project(f.x, f.y + f.t * 0.7, f.z);
      if (s.z > 1) { f.el.style.display = 'none'; continue; }
      f.el.style.display = '';
      f.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      f.el.style.opacity = f.t < 1 ? 1 : 1 - (f.t - 1) / 0.4;
    }
  }
  function flashRes(r) { const el = $('r-' + r); if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

  // ---------------- command buttons ----------------
  function costHTML(cost, p) {
    return Object.keys(cost).map(r => `<span class="${p && Math.floor(p.res[r]) < cost[r] ? 'bad' : ''}"><i style="background-image:url(${resIcon(r)})"></i>${cost[r]}</span>`).join('');
  }
  function shortCost(cost) { return Object.keys(cost).map(r => cost[r] + r[0].toUpperCase()).join(' '); }
  function buildCommands() {
    const out = new Array(18).fill(null);
    const s = Input.selection();
    const p = players[HUMAN];
    if (!s.length || s[0].owner !== HUMAN || s[0].dead) return out;
    if (s[0].kind === 'unit') {
      const us = s.filter(e => e.kind === 'unit');
      const vils = us.filter(u => u.type === 'villager');
      if (vils.length) {
        VIL_BUILDS.forEach((t, i) => {
          const d = BUILDINGS[t];
          let reason = null;
          if (p.age < d.age) reason = 'Requires ' + AGE_NAMES[d.age];
          else if (d.needs && !buildings.some(b => b.owner === HUMAN && b.type === d.needs && b.built && !b.dead)) reason = 'Requires a ' + BUILDINGS[d.needs].name;
          out[i] = { icon: View.ICONS['b_' + t], title: 'Build ' + d.name, cost: d.cost, desc: d.desc, lock: !!reason, reason, na: !canAfford(p, d.cost),
            act: () => { if (reason) return fail(reason); if (!canAfford(p, d.cost)) { flashRes(missingRes(p, d.cost)); return fail('Not enough ' + missingRes(p, d.cost)); } Input.startPlace(t); } };
        });
      }
      const gar = us.filter(u => u.type !== 'villager' && UNITS[u.type].cls !== 'cavalry' && UNITS[u.type].cls !== 'siege');
      out[16] = { icon: glyph('stop'), title: 'Stop', desc: 'Stop all current actions. Stopped villagers are left alone by Auto-work.', act: () => { for (const u of us) { orderStop(u); u.parked = true; } } };
      out[17] = { icon: glyph('del'), title: 'Delete', desc: 'Delete the selected units. (also the Delete key)', act: () => Input.deleteSel() };
      if (!vils.length) {
        out[12] = { icon: glyph('arrow'), title: 'Attack-move', desc: 'Click this, then click the map: the selection marches there and fights every enemy on the way.', act: () => Input.startAttackMove() };
        out[13] = { icon: glyph('sword2'), title: 'Charge the enemy!', desc: 'Send the selected army against the nearest known enemy building (or the enemy homeland if none has been scouted). Herbalists follow behind.', act: () => Input.charge() };
        if (gar.length) out[14] = { icon: glyph('out'), title: 'Garrison in nearest tower/castle', desc: 'Sends infantry and archers into the nearest tower or castle.', act: () => { for (const u of gar) { let best = null, bd = 1e9; for (const b of buildings) if (b.owner === HUMAN && !b.dead && b.built && canGarrison(u, b) && b.garrison.length < BUILDINGS[b.type].garrison) { const d = dist2(u.x, u.z, b.x, b.z); if (d < bd) { bd = d; best = b; } } if (best) orderGarrison(u, best); } } };
      } else {
        out[17] = { icon: glyph('del'), title: 'Delete', desc: 'Delete the selected units. (also the Delete key)', act: () => Input.deleteSel() };
      }
      const rb = vils.length ? REALM_BUILD[p.faction] : null;
      if (rb) {
        const d = BUILDINGS[rb], reason = p.age < d.age ? 'Requires ' + AGE_NAMES[d.age] : null;
        out[17] = { icon: View.ICONS['b_' + rb], title: 'Build ' + d.name + ' ★', cost: d.cost, desc: '<b>Unique to the ' + p.name + '.</b> ' + d.desc, lock: !!reason, reason, na: !canAfford(p, d.cost),
          act: () => { if (reason) return fail(reason); if (!canAfford(p, d.cost)) { flashRes(missingRes(p, d.cost)); return fail('Not enough ' + missingRes(p, d.cost)); } Input.startPlace(rb); } };
      }
      return out;
    }
    if (s[0].kind !== 'building') return out;
    const type = s[0].type;
    const bs = s.filter(e => e.kind === 'building' && e.type === type && !e.dead);
    const b = bs[0], d = BUILDINGS[type];
    const pickB = () => bs.filter(x => x.built).sort((a, c) => a.queue.length - c.queue.length)[0] || b;
    if (!b.built) { out[17] = { icon: glyph('del'), title: 'Cancel construction', desc: 'Demolish this foundation.', act: () => Input.deleteSel() }; return out; }
    let i = 0;
    for (const ut of (d.trains || []).filter(k => realmOk(UNITS[k], p))) {
      const u = UNITS[ut];
      const reason = p.age < u.age ? 'Requires ' + AGE_NAMES[u.age] : null;
      out[i++] = { icon: View.ICONS[ut], title: 'Train ' + u.name + (u.realm ? ' ★' : ''), cost: u.cost, desc: u.desc + `<br><span style="color:#9b9586">HP ${u.hp} · Atk ${u.atk} · Armor ${u.marm}/${u.parm}${u.range > 1 ? ' · Range ' + u.range : ''} · ${u.time}s</span>`, lock: !!reason, reason, na: !canAfford(p, u.cost),
        act: () => { const bb = pickB(); const err = queueTrain(bb, ut); if (err) { if (err.startsWith('Not enough')) flashRes(err.split(' ').pop()); fail(err); } else Sound.play('click'); } };
    }
    i = 6;
    for (const tk of d.techs || []) {
      const t = TECHS[tk];
      if (p.techs.has(tk)) continue;
      if (t.ageUp && p.age !== t.age) continue;
      if (!t.ageUp && t.req && !p.techs.has(t.req) && !p.researching.has(t.req)) continue;
      const err0 = techBlock(b, tk);
      const researching = p.researching.has(tk);
      const lock = researching || (err0 && !err0.startsWith('Not enough') && !err0.startsWith('Queue'));
      out[i++] = { icon: glyph(t.icon), title: t.name + (researching ? ' (researching)' : ''), cost: t.cost, desc: t.desc, lock, reason: err0 && !err0.startsWith('Not enough') ? err0 : null, na: !canAfford(p, t.cost), time: t.time,
        act: () => { const err = queueTech(b, tk); if (err) { if (err.startsWith('Not enough')) flashRes(err.split(' ').pop()); fail(err); } else Sound.play('click'); } };
      if (i >= 12) break;
    }
    if (!NO_UPGRADE.includes(b.type) && (b.level || 1) < 3) {
      const err = upgradeBlock(b), L = b.level || 1, c = upgradeCost(b);
      out[14] = { icon: glyph('age2'), title: 'Upgrade to Level ' + (L + 1), cost: c, time: 20 + 15 * L, desc: '+25% HP, +1 armor, +20% production speed' + (BUILDINGS[b.type].attack ? ', +1 arrow and range' : '') + (BUILDINGS[b.type].pop ? ', +2 population' : '') + '. Level ' + (L + 1) + ' needs the ' + AGE_NAMES[L] + '.',
        lock: !!(err && !err.startsWith('Not enough') && !err.startsWith('Queue')), reason: err && !err.startsWith('Not enough') ? err : null, na: !canAfford(p, c),
        act: () => { const e2 = queueUpgrade(b); if (e2) { if (e2.startsWith('Not enough')) flashRes(e2.split(' ').pop()); fail(e2); } else Sound.play('click'); } };
    }
    if (d.garrison && b.garrison.length) out[15] = { icon: glyph('out'), title: 'Ungarrison (' + b.garrison.length + ')', desc: 'Release all garrisoned units.', act: () => { for (const x of bs) ungarrison(x); } };
    out[17] = { icon: glyph('del'), title: 'Delete', desc: 'Delete this building. (also the Delete key)', act: () => Input.deleteSel() };
    return out;
  }
  function fail(msg) { notify(msg, 'warn', 'fail' + msg); Sound.play('error'); }
  function trigger(i) {
    const c = cmds[i]; if (!c) return false;
    if (Game.paused) return true;
    c.act(); selDirty = true; refreshCommands(true); return true;
  }
  function hotkey(letter) { const i = HOTKEYS.indexOf(letter); if (i < 0 || !cmds[i]) return false; return trigger(i); }
  function refreshCommands(force) {
    cmds = buildCommands();
    const sig = cmds.map(c => c ? c.title + (c.na ? 1 : 0) + (c.lock ? 1 : 0) : '-').join('|');
    if (!force && sig === cmdSig) return;
    cmdSig = sig;
    cmds.forEach((c, i) => {
      const el = btnEls[i];
      if (!c) { el.className = 'cb empty'; el.style.backgroundImage = ''; return; }
      el.className = 'cb' + (c.lock ? ' lock' : c.na ? ' na' : '');
      el.style.backgroundImage = `url(${c.icon})`;
      el.querySelector('.hk').textContent = c.hk || HOTKEYS[i];
      el.querySelector('.ct').textContent = c.cost ? shortCost(c.cost) : '';
    });
    if (tipFor !== null) showTip(tipFor, btnEls[tipFor]);
  }
  function showTip(i, el) {
    const c = cmds[i]; if (!c) return hideTip();
    tipFor = i;
    const p = players[HUMAN];
    const tip = $('tooltip');
    tip.innerHTML = `<div class="tt">${c.title}<span class="tk">[${c.hk || HOTKEYS[i]}]</span></div>` + (c.cost ? `<div class="tc">${costHTML(c.cost, p)}${c.time ? `<span style="color:#9b9586">${c.time}s</span>` : ''}</div>` : '') + `<div class="td">${c.desc || ''}</div>` + (c.reason ? `<div class="tr">${c.reason}</div>` : '');
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 6, innerWidth - tw - 6) + 'px';
    tip.style.top = Math.max(6, r.top - th - 8) + 'px';
  }
  function hideTip() { tipFor = null; $('tooltip').classList.add('hidden'); }

  // ---------------- info panel ----------------
  function hpColor(f) { return f > 0.5 ? '#5fd35a' : f > 0.25 ? '#e8c547' : '#e0483a'; }
  function portraitOf(e) {
    if (e.kind === 'unit') return View.ICONS[e.type];
    if (e.kind === 'building') return View.ICONS['b_' + e.type];
    if (e.model && View.ICONS['r_' + e.model]) return View.ICONS['r_' + e.model];
    return View.ICONS['r_' + (e.rtype === 'tree' ? e.variant : e.rtype)];
  }
  function renderInfo() {
    const s = Input.selection().filter(e => !e.dead);
    document.body.classList.toggle('hassel', s.length > 0);
    const info = $('info'), img = $('portImg');
    if (!s.length) {
      const sig = 'none' + players[HUMAN].age;
      if (sig !== infoSig) { infoSig = sig; img.src = View.ICONS.b_towncenter || ''; info.innerHTML = `<div class="nm">${players[HUMAN].name}</div><div class="sub">${AGE_NAMES[players[HUMAN].age]}</div><div class="sub" style="margin-top:6px">Select a unit or building. Right click to command.<br>Press <b>.</b> for idle villagers, <b>,</b> for your army.</div>`; }
      return;
    }
    if (s.length > 1 && s.every(e => e.kind === 'unit')) {
      const counts = {}; for (const u of s) counts[u.type] = (counts[u.type] || 0) + 1;
      const sig = 'm' + s.map(u => u.id + ':' + Math.ceil(u.hp)).join(',');
      if (sig === infoSig) return; infoSig = sig;
      img.src = View.ICONS[s[0].type];
      const own = s[0].owner === HUMAN;
      info.innerHTML = `<div class="nm">${s.length} units</div><div class="multi">` + s.slice(0, 40).map(u => `<div class="mi" data-id="${u.id}" style="background-image:url(${View.ICONS[u.type]})"><div class="mhp"><div style="width:${u.hp / u.maxHp * 100}%;background:${hpColor(u.hp / u.maxHp)}"></div></div></div>`).join('') + '</div>';
      info.querySelectorAll('.mi').forEach(el => el.onclick = ev => { const u = ents.get(+el.dataset.id); if (!u) return; if (ev.shiftKey) Input.setSelection(Input.selection().filter(x => x !== u)); else Input.setSelection(own ? Input.selection().filter(x => x.type === u.type) : [u]); });
      return;
    }
    if (s.length > 1) {
      const sig = 'mb' + s.map(b => b.id + ':' + (b.queue ? b.queue.length : 0)).join(',');
      if (sig === infoSig) return; infoSig = sig;
      img.src = portraitOf(s[0]);
      info.innerHTML = `<div class="nm">${s.length} × ${BUILDINGS[s[0].type] ? BUILDINGS[s[0].type].name : ''}</div><div class="sub">Commands train in the building with the shortest queue.</div>`;
      return;
    }
    const e = s[0];
    let html = '', sig = '';
    if (e.kind === 'unit') {
      const st = ustat(e.owner, e.type);
      const carry = e.carry > 0.5 ? `Carrying <b>${Math.floor(e.carry)} ${e.carryType}</b>` : '';
      const task = e.type === 'villager' ? ({ gather: 'Gathering ' + (e.gres || ''), return: 'Returning ' + (e.carryType || ''), build: 'Building', idle: 'Idle', move: 'Moving', garrison: 'Garrisoning', attack: 'Fighting' }[e.state] || '') : ({ idle: 'Idle', move: 'Moving', amove: 'Attack-moving', attack: 'Fighting' }[e.state] || '');
      sig = `u${e.id}:${Math.ceil(e.hp)}:${Math.floor(e.carry)}:${e.state}:${st.atk}:${st.marm}`;
      html = `<div class="nm" style="color:${TEAM_CSS[e.owner]}">${UNITS[e.type].name}</div><div class="sub">${players[e.owner].name}${task ? ' · ' + task : ''}</div>
        <div class="hpb"><div style="width:${e.hp / e.maxHp * 100}%;background:${hpColor(e.hp / e.maxHp)}"></div></div><div class="sub">${Math.ceil(e.hp)} / ${e.maxHp} HP</div>
        <div class="stats">${!isAnimal(e) ? `<span>Attack <b>${UNITS[e.type].atk}</b>${st.atk > UNITS[e.type].atk ? `<i class="up">+${st.atk - UNITS[e.type].atk}</i>` : ''}</span><span>Armor <b>${UNITS[e.type].marm}/${UNITS[e.type].parm}</b>${st.marm > UNITS[e.type].marm || st.parm > UNITS[e.type].parm ? `<i class="up">+${st.marm - UNITS[e.type].marm}/+${st.parm - UNITS[e.type].parm}</i>` : ''}</span><span>Range <b>${st.range > 1 ? st.range : 'melee'}</b></span><span>Speed <b>${st.speed.toFixed(1)}</b></span>` : `<span>Food <b>${UNITS[e.type].food}</b></span>${UNITS[e.type].aggressive ? '<span style="color:#ff8a7a">Fights back!</span>' : UNITS[e.type].livestock ? '<span>Livestock</span>' : '<span>Flees</span>'}`}</div>
        ${carry ? `<div class="stats">${carry}</div>` : ''}${UI2.counterHTML(e.type)}`;
    } else if (e.kind === 'building') {
      const d = BUILDINGS[e.type];
      const q = e.queue || [];
      sig = `b${e.id}:${e.level}:${Math.ceil(e.hp)}:${e.built}:${Math.floor(e.progress * 100)}:${q.map(x => x.id + Math.floor(x.t / x.total * 20)).join(',')}:${e.garrison.length}:${Math.floor(e.amount || 0)}:${e.wonderT | 0}:${e.age}`;
      let extra = '';
      if (!e.built) extra = `<div class="stats">Under construction: <b>${Math.floor(e.progress * 100)}%</b></div>`;
      else {
        const bits = [];
        if (!NO_UPGRADE.includes(e.type)) bits.push(`Level <b style="color:#f3c969">${'★'.repeat(e.level || 1)}${'☆'.repeat(3 - (e.level || 1))}</b>`);
        if (d.pop) bits.push(`Population <b>+${d.pop + 2 * ((e.level || 1) - 1)}</b>`);
        if (d.attack) { const bst = bstat(e.owner, e.type); bits.push(`Arrows <b>${bst.atk}</b> dmg · range <b>${bst.range}</b>`); }
        if (d.garrison) bits.push(`Garrison <b>${e.garrison.length}/${d.garrison}</b>`);
        if (d.drop) bits.push(`Accepts <b>${d.drop.join(', ')}</b>`);
        if (e.type === 'farm') bits.push(`Food left <b>${Math.floor(e.amount)}</b>`);
        if (e.type === 'wonder' && e.wonderT !== undefined) bits.push(`Victory in <b>${fmtTime(e.wonderT)}</b>`);
        extra = `<div class="stats">${bits.map(b => `<span>${b}</span>`).join('')}</div>`;
      }
      let qh = '';
      if (e.owner === HUMAN && e.built && (d.trains || d.techs)) {
        qh = '<div class="queue">';
        for (let i = 0; i < 5; i++) {
          const it = q[i];
          if (!it) { qh += '<div class="qi empty"></div>'; continue; }
          const icon = it.kind === 'unit' ? View.ICONS[it.id] : it.kind === 'upgrade' ? glyph('age2') : glyph(TECHS[it.id].icon);
          qh += `<div class="qi" data-i="${i}" title="Click to cancel" style="background-image:url(${icon})">${i === 0 ? `<div class="qp" style="width:${it.t / it.total * 100}%"></div>` : ''}</div>`;
        }
        qh += '</div>';
      }
      html = `<div class="nm" style="color:${TEAM_CSS[e.owner]}">${d.name}</div><div class="sub">${players[e.owner].name}</div>
        <div class="hpb"><div style="width:${e.hp / e.maxHp * 100}%;background:${hpColor(e.hp / e.maxHp)}"></div></div><div class="sub">${Math.ceil(e.hp)} / ${e.maxHp} HP</div>${extra}${qh}`;
    } else {
      sig = `r${e.id}:${Math.floor(e.amount)}`;
      const nm = { tree: 'Tree', gold: 'Gold Mine', stone: 'Stone Mine', berry: 'Berry Bush', carcass: 'Carcass' }[e.rtype];
      const nm2 = { meat_ham: 'Ham (fresh kill)', meat_steak: 'Meat (fresh kill)', meat_fish: 'Fish (fresh catch)' }[e.model];
      html = `<div class="nm">${nm2 || nm}</div><div class="sub">Natural resource</div><div class="stats"><span>${e.res[0].toUpperCase() + e.res.slice(1)} left <b>${Math.floor(e.amount)}</b></span></div>`;
    }
    if (sig === infoSig) return;
    infoSig = sig;
    img.src = portraitOf(e) || '';
    info.innerHTML = html;
    info.querySelectorAll('.qi[data-i]').forEach(el => el.onclick = () => { cancelQueue(e, +el.dataset.i); Sound.play('click'); infoSig = ''; });
  }

  // ---------------- top bar ----------------
  let rateHist = [];
  function renderTop() {
    const p = players[HUMAN];
    if (!rateHist.length || Game.time < rateHist[rateHist.length - 1].t) rateHist = [];
    if (!rateHist.length || Game.time - rateHist[rateHist.length - 1].t >= 5) { rateHist.push({ t: Game.time, g: Object.assign({}, p.stats.gathered) }); if (rateHist.length > 7) rateHist.shift(); }
    const h0 = rateHist[0], hd = Math.max(1, Game.time - h0.t);
    const idleN = units.filter(u => u.owner === HUMAN && u.type === 'villager' && !u.dead && !u.garrisonIn && u.state === 'idle').length;
    const armyN = units.filter(u => u.owner === HUMAN && isMil(u) && !u.dead).length;
    $('btnIdle').innerHTML = 'Idle <b>' + idleN + '</b>'; $('btnIdle').classList.toggle('hot', idleN > 0);
    $('btnArmy').innerHTML = 'Army <b>' + armyN + '</b>';
    const tod = Atmos.tod, night = tod < 0.23 || tod > 0.77;
    $('todInd').innerHTML = `<span class="${night ? 'moon' : 'sun'}">${night ? '☾' : '☀'}</span> ${{ clear: night ? 'Clear night' : 'Clear', rain: 'Rain', storm: 'Storm', snow: 'Snow', fog: 'Fog' }[Atmos.weather]}`;
    const cnt = { food: 0, wood: 0, stone: 0, gold: 0 };
    for (const u of units) if (u.owner === HUMAN && u.type === 'villager' && !u.dead && (u.state === 'gather' || u.state === 'return') && u.gres) cnt[u.gres]++;
    for (const r of RESN) { const el = $('r-' + r); el.querySelector('b').textContent = Math.floor(p.res[r]); const rate = Math.round((p.stats.gathered[r] - h0.g[r]) / hd * 60); el.querySelector('small').innerHTML = (cnt[r] ? cnt[r] + '<span class="wk">⚒</span>' : '') + (rate > 0 ? ' <span class="rt">+' + rate + '/m</span>' : ''); el.title = r[0].toUpperCase() + r.slice(1) + ': ' + cnt[r] + ' villagers gathering, +' + rate + ' per minute'; }
    const pe = $('r-pop').querySelector('b'); pe.textContent = p.pop + '/' + p.popCap; pe.style.color = p.pop >= p.popCap ? '#ff8a7a' : '';
    let ageTxt = AGE_NAMES[p.age];
    for (const b of buildings) if (b.owner === HUMAN && !b.dead) for (const it of b.queue) if (it.kind === 'tech' && TECHS[it.id].ageUp && b.queue[0] === it) ageTxt += ` → ${Math.floor(it.t / it.total * 100)}%`;
    $('ageName').textContent = ageTxt;
    $('clock').textContent = fmtTime(Game.time);
    $('speedInd').textContent = (Game.speed !== 1 ? Game.speed + 'x · ' : '') + (Game.fps ? Math.round(Game.fps) + ' fps' : '');
    let w = '';
    for (const b of buildings) if (b.type === 'wonder' && b.built && !b.dead && b.wonderT !== undefined) w += `<span style="color:${TEAM_CSS[b.owner]}">Wonder ${fmtTime(b.wonderT)}</span> `;
    $('wonderInfo').innerHTML = w;
  }
  function update(dt) {
    tick -= dt;
    if (tick > 0 && !selDirty) return;
    tick = 0.2; selDirty = false;
    renderTop(); refreshCommands(); renderInfo();
    $('vSun').textContent = '☼ ' + ({ cycle: 'Cycle', day: 'Day', dusk: 'Dusk', night: 'Night' }[Settings.timeMode || 'cycle']);
    $('vWx').textContent = 'Weather: ' + ((Settings.weather || 'dynamic') === 'dynamic' ? 'Auto (' + Atmos.weather + ')' : Settings.weather);
  }
  function selChanged() { selDirty = true; infoSig = ''; }
  return {
    init, notify, flashRes, hotkey, update, floatText, frame, selChanged, touchState,
    get subMenuOpen() { return subStack.length > 0; }, closeSub() { Menus.back(); },
    _sub: subStack, hideTip, reset() { cmdSig = ''; infoSig = ''; $('notes').innerHTML = ''; hideTip(); for (const f of floats) f.el.remove(); floats.length = 0; },
  };
})();

// =====================================================================
//  MINIMAP
// =====================================================================
const Minimap = (() => {
  let cv, g, base, bg, fogC, fg, fogImg, dirty = true, t = 0;
  const opts = { res: true, units: true };
  const pings = [];
  const S = 240;
  function init() {
    cv = $('minimap'); g = cv.getContext('2d');
    base = document.createElement('canvas'); bg = base.getContext('2d');
    fogC = document.createElement('canvas'); fg = fogC.getContext('2d');
    resize();
    let drag = false;
    const toWorld = e => { const r = cv.getBoundingClientRect(); const cx = (e.clientX - r.left) / r.width * N, cz = (e.clientY - r.top) / r.height * N; return { x: cx, z: cz }; };
    cv.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); const w = toWorld(e); if (e.button === 2) { Input.contextAction(0, 0, w); return; } drag = true; camJump(w.x, w.z); });
    window.addEventListener('mousemove', e => { if (drag) { const w = toWorld(e); camJump(w.x, w.z); } });
    window.addEventListener('mouseup', () => drag = false);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('touchstart', e => { e.preventDefault(); const w = toWorld(e.touches[0]); camJump(w.x, w.z); }, { passive: false });
    cv.addEventListener('touchmove', e => { e.preventDefault(); const w = toWorld(e.touches[0]); camJump(w.x, w.z); }, { passive: false });
  }
  function resize() { base.width = base.height = N; fogC.width = fogC.height = N; fogImg = fg.createImageData(N, N); dirty = true; }
  function renderBase() {
    const img = bg.createImageData(N, N), tc = World.terrainColors;
    for (let i = 0; i < N * N; i++) { img.data[i * 4] = tc[i * 3]; img.data[i * 4 + 1] = tc[i * 3 + 1]; img.data[i * 4 + 2] = tc[i * 3 + 2]; img.data[i * 4 + 3] = 255; }
    for (const r of opts.res ? resources : []) {
      if (r.dead) continue;
      const c = r.rtype === 'treasure' ? [255, 240, 120] : r.rtype === 'tree' ? [34, 78, 36] : r.rtype === 'gold' ? [250, 210, 60] : r.rtype === 'stone' ? [190, 190, 196] : r.rtype === 'berry' ? [200, 70, 90] : null;
      if (!c) continue;
      for (let y = r.ty; y < r.ty + r.size; y++) for (let x = r.tx; x < r.tx + r.size; x++) { const i = idx(x, y) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; }
    }
    for (const pr of World.props || []) for (let y = pr.ty; y < pr.ty + pr.s; y++) for (let x = pr.tx; x < pr.tx + pr.s; x++) { const i = idx(x, y) * 4; img.data[i] = 150; img.data[i + 1] = 140; img.data[i + 2] = 120; }
    bg.putImageData(img, 0, 0);
  }
  function draw(dt) {
    t -= dt; for (const p of pings) p.t -= dt;
    if (t > 0) return; t = 0.15;
    if (dirty) { renderBase(); dirty = false; }
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, S, S);
    const play = Game.mode === 'play' && !Game.reveal;
    const ph = players[HUMAN];
    const k = S / N;
    for (const b of buildings) {
      if (b.dead) continue;
      if (play && b.owner !== HUMAN && !b.seenBy0) continue;
      g.fillStyle = TEAM_CSS[b.owner]; g.fillRect(b.tx * k - 0.5, b.ty * k - 0.5, b.size * k + 1, b.size * k + 1);
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.strokeRect(b.tx * k - 0.5, b.ty * k - 0.5, b.size * k + 1, b.size * k + 1);
    }
    for (const u of opts.units ? units : []) {
      if (u.dead || u.garrisonIn) continue;
      if (play && u.owner !== HUMAN && !ph.vis[idx(u.x | 0, u.z | 0)]) continue;
      const wd = UNITS[u.type];
      g.fillStyle = isAnimal(u) ? (wd.hostile || wd.cls === 'creep' ? '#ff4040' : wd.aggressive ? '#c0603a' : '#e8d8a8') : TEAM_CSS[u.owner];
      if (wd.boss) { g.fillRect(u.x * k - 3, u.z * k - 3, 6, 6); continue; }
      g.fillRect(u.x * k - 1.5, u.z * k - 1.5, 3, 3);
    }
    if (play) {
      const d = fogImg.data;
      for (let i = 0; i < N * N; i++) { d[i * 4 + 3] = ph.vis[i] ? 0 : ph.exp[i] ? 120 : 255; }
      fg.putImageData(fogImg, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(fogC, 0, 0, S, S);
    }
    // camera footprint
    const corners = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight - 180], [0, innerHeight - 180]].map(([x, y]) => Input.screenToGround(x, Math.max(50, y)));
    if (corners.every(Boolean)) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); corners.forEach((c, i) => { const x = clamp(c.x, -5, N + 5) * k, y = clamp(c.z, -5, N + 5) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke(); }
    for (let i = pings.length - 1; i >= 0; i--) {
      const p = pings[i]; if (p.t <= 0) { pings.splice(i, 1); continue; }
      const ph2 = (3 - p.t) % 1; g.strokeStyle = `rgba(255,70,50,${1 - ph2})`; g.lineWidth = 2.5; g.beginPath(); g.arc(p.x * k, p.z * k, 4 + ph2 * 18, 0, 7); g.stroke();
    }
  }
  function ping(x, z) { pings.push({ x, z, t: 3 }); }
  return { opts, init, draw, ping, set dirty(v) { dirty = v; }, get dirty() { return dirty; }, reset() { pings.length = 0; if (base && base.width !== N) resize(); dirty = true; } };
})();

// =====================================================================
//  MENUS
// =====================================================================
const Menus = (() => {
  const stack = UI._sub || [];
  function seg(id, val, onPick) {
    const el = $(id);
    const set = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
    set(val);
    el.querySelectorAll('button').forEach(b => b.onclick = () => { Sound.init(); Sound.play('click'); set(b.dataset.v); onPick(b.dataset.v); });
  }
  function open(id) { $(id).classList.remove('hidden'); }
  function close(id) { $(id).classList.add('hidden'); }
  function sub(id) { stack.push(id); open(id); }
  function back() { const id = stack.pop(); if (id) close(id); }
  let curCamp = 'shatter';
  function renderChapters() {
    $('campSel').innerHTML = CAMPAIGNS.map(c => { const n = CAMPAIGN.filter(x => x.camp === c.key).length, done = Math.min(n, campaignProgress(c.key) - 1); return `<button data-k="${c.key}" class="${c.key === curCamp ? 'on' : ''}"><b>${c.title}</b><small>${FACTIONS[c.realm].name} · ${done}/${n}</small></button>`; }).join('');
    $('campSel').querySelectorAll('button').forEach(b => b.onclick = () => { Sound.init(); Sound.play('click'); curCamp = b.dataset.k; renderChapters(); });
    const cp = CAMPAIGNS.find(c => c.key === curCamp), prog = campaignProgress(curCamp);
    $('campBlurb').innerHTML = `<b>${cp.hero}</b> — ${cp.blurb}`;
    $('chapters').innerHTML = CAMPAIGN.filter(c => c.camp === curCamp).map(c => {
      const locked = c.num > prog, TH = MAP_THEMES[c.theme];
      return `<div class="chap ${locked ? 'locked' : ''}" data-id="${c.id}"><div class="cn">Chapter ${c.num}${c.num < prog ? ' <span class="done">✓</span>' : ''}</div><div class="ct">${c.title}</div><div class="cd">${TH.name} · vs ${FACTIONS[c.ef].name} · ${c.diff[0].toUpperCase() + c.diff.slice(1)}</div><button class="lbtn cplay" ${locked ? 'disabled' : ''}>${locked ? '🔒 Locked' : 'Play'}</button></div>`;
    }).join('');
    $('chapters').querySelectorAll('.chap:not(.locked) .cplay').forEach(b => b.onclick = () => { Sound.init(); Sound.play('click'); Game.start(chapterOpts(CAMPAIGN.find(x => x.id === +b.parentElement.dataset.id))); });
  }
  function realmInfo() {
    const f = FACTIONS[GameOpts.pf];
    $('realmDesc').innerHTML = `<b>${f.name}</b> — ${f.style}<ul>${f.bonuses.map(b => `<li>${b}</li>`).join('')}</ul>`;
  }
  function openChronicle() {
    const realm = k => { const f = FACTIONS[k]; return `<div class="cr"><h4>${f.name} <small>“${f.motto}”</small></h4><p>${f.lore}</p><ul>${f.bonuses.map(b => `<li>${b}</li>`).join('')}</ul></div>`; };
    const saga = c => `<div class="cr"><h4>${c.title} <small>${c.hero}</small></h4>` + CAMPAIGN.filter(x => x.camp === c.key).map(x => x.num < campaignProgress(c.key) ? `<p><b>${x.num}. ${x.title}.</b> ${x.outro}</p>` : `<p class="lk"><b>${x.num}. ${x.title}.</b> 🔒 Finish this chapter to record its ending.</p>`).join('') + '</div>';
    $('chronBody').innerHTML = '<h3>The World of Ironvale</h3>' + CHRONICLE.map(([t2, tx]) => `<div class="cr"><h4>${t2}</h4><p>${tx}</p></div>`).join('') + '<h3>The Realms</h3>' + Object.keys(FACTIONS).map(realm).join('') + '<h3>The Sagas</h3>' + CAMPAIGNS.map(saga).join('');
    sub('chronicle');
  }
  function tab(which) {
    $('tabCamp').classList.toggle('on', which === 'camp'); $('tabSkir').classList.toggle('on', which === 'skir');
    $('pCamp').classList.toggle('hidden', which !== 'camp'); $('pSkir').classList.toggle('hidden', which !== 'skir');
  }
  function init() {
    seg('optDiff', GameOpts.difficulty, v => GameOpts.difficulty = v);
    seg('optSpeed', GameOpts.speed, v => GameOpts.speed = +v);
    seg('optBoost', GameOpts.boost, v => GameOpts.boost = +v);
    seg('optMap', GameOpts.theme, v => { GameOpts.theme = v; $('mapDesc').textContent = MAP_THEMES[v].desc; });
    seg('optSize', GameOpts.size, v => GameOpts.size = v);
    $('mapDesc').textContent = MAP_THEMES[GameOpts.theme].desc;
    $('optSeed').value = GameOpts.seed;
    $('optSeed').addEventListener('input', () => { const v = parseInt($('optSeed').value.replace(/\D/g, ''), 10); if (v) GameOpts.seed = v; });
    $('seedRnd').onclick = () => { GameOpts.seed = (Math.random() * 900000 + 100000) | 0; $('optSeed').value = GameOpts.seed; Sound.init(); Sound.play('click'); };
    $('btnStart').onclick = () => { Sound.init(); Sound.play('click'); const v = parseInt($('optSeed').value.replace(/\D/g, ''), 10); if (v) GameOpts.seed = v; Game.start({ seed: GameOpts.seed, difficulty: GameOpts.difficulty, theme: GameOpts.theme, size: GameOpts.size, chapter: null, pf: GameOpts.pf, ef: GameOpts.ef }); };
    $('tabCamp').onclick = () => { Sound.init(); tab('camp'); }; $('tabSkir').onclick = () => { Sound.init(); tab('skir'); };
    renderChapters(); tab('camp');
    seg('optPF', GameOpts.pf, v => { GameOpts.pf = v; realmInfo(); });
    seg('optEF', GameOpts.ef, v => { GameOpts.ef = v; });
    realmInfo();
    $('btnChron').onclick = () => { Sound.init(); openChronicle(); };
    $('chronBack').onclick = back;
    $('btnSettings').onclick = () => { Sound.init(); sub('settings'); };
    $('btnControls').onclick = () => { Sound.init(); sub('controls'); };
    seg('setQ', Settings.quality, v => { Settings.quality = v; saveSettings(); applyQuality(); });
    seg('setEdge', Settings.edgeScroll ? 1 : 0, v => { Settings.edgeScroll = v === '1'; saveSettings(); });
    seg('setTime', Settings.timeMode || 'cycle', v => { Settings.timeMode = v; saveSettings(); });
    seg('setWx', Settings.weather || 'dynamic', v => { Settings.weather = v; saveSettings(); });
    $('setVol').value = Settings.volume; $('setMus').value = Settings.music;
    $('setVol').oninput = () => { Settings.volume = +$('setVol').value; saveSettings(); Sound.applyVolume(); };
    $('setMus').oninput = () => { Settings.music = +$('setMus').value; saveSettings(); Sound.applyVolume(); };
    $('setVol').onchange = () => Sound.play('click');
    $('setBack').onclick = back; $('ctlBack').onclick = back;
    $('pResume').onclick = () => Game.togglePause(false);
    $('pSave').onclick = () => Slots.show('save');
    $('pLoad').onclick = () => Slots.show('load');
    $('btnLoad').onclick = () => { Sound.init(); Sound.play('click'); Slots.show('load'); };
    $('pSurrender').onclick = () => { close('pause'); Game.paused = false; Game.end(false, 'You surrendered to the ' + players[AIP].name + '.'); };
    $('btnContinue').onclick = () => { Sound.init(); Sound.play('click'); const d = SaveGame.latest(); if (d) SaveGame.load(d.slot); };
    seg('setTips', Settings.tips === false ? 0 : 1, v => { Settings.tips = v === '1'; saveSettings(); });
    seg('setAutoQ', Settings.autoQuality === false ? 0 : 1, v => { Settings.autoQuality = v === '1'; saveSettings(); });
    $('pRestart').onclick = () => { close('pause'); Game.start(); };
    $('pSettings').onclick = () => sub('settings');
    $('pControls').onclick = () => sub('controls');
    $('pQuit').onclick = () => { close('pause'); Game.toMenu(); };
    $('eAgain').onclick = () => { close('endscreen'); Game.start(); };
    $('eMenu').onclick = () => { close('endscreen'); renderChapters(); Game.toMenu(); };
    $('eNext').onclick = () => { close('endscreen'); const c = CAMPAIGN.find(x => x.id === Game.chapter.id + 1); if (c) Game.start(chapterOpts(c)); };
    $('storyGo').onclick = () => { Sound.init(); Sound.play('click'); close('story'); if (Game.mode === 'play' && !Game.over) Game.paused = false; };
  }
  function showEnd(win, reason) {
    const p0 = players[0], p1 = players[1], ch = Game.chapter;
    $('endTitle').textContent = win ? 'Victory' : 'Defeat';
    $('endTitle').className = win ? 'win' : 'lose';
    $('endSub').innerHTML = reason + (ch ? `<div class="obj-end">${Story.summaryHTML()}</div>` + (win ? `<p class="outro">${ch.outro}</p>` : '') : '');
    const sum = p => Math.floor(RESN.reduce((a, r) => a + p.stats.gathered[r], 0));
    const row = (label, f) => `<tr><td>${label}</td><td>${f(p0)}</td><td>${f(p1)}</td></tr>`;
    $('endStats').innerHTML = `<tr><th></th><th style="color:${TEAM_CSS[0]}">${p0.name}</th><th style="color:${TEAM_CSS[1]}">${p1.name}</th></tr>` +
      row('Resources gathered', sum) + RESN.map(r => row('&nbsp;&nbsp;' + r[0].toUpperCase() + r.slice(1), p => Math.floor(p.stats.gathered[r]))).join('') +
      row('Units trained', p => p.stats.trained) + row('Units lost', p => p.stats.lost) + row('Enemies killed', p => p.stats.kills) +
      row('Treasures / beasts slain', p => (p.stats.treasures || 0) + ' / ' + (p.stats.bosses || 0)) +
      row('Buildings destroyed', p => p.stats.bldDestroyed) + row('Buildings lost', p => p.stats.bldLost) + row('Age reached', p => AGE_NAMES[p.age].replace(' Age', '')) +
      `<tr><td>Game time</td><td colspan="2" style="text-align:center">${fmtTime(Game.time)}</td></tr>`;
    $('eNext').classList.toggle('hidden', !(win && ch && CAMPAIGN.some(c => c.id === ch.id + 1)));
    $('eAgain').textContent = ch ? (win ? 'Replay Chapter' : 'Retry Chapter') : 'Play Again';
    open('endscreen');
  }
  function refreshContinue() {
    const d = SaveGame.latest(), b = $('btnContinue');
    b.classList.toggle('hidden', !d); $('btnLoad').classList.toggle('hidden', !d);
    if (d) b.innerHTML = 'Continue' + (d.slot === 'auto' ? '' : ' · slot ' + d.slot) + '<small>' + SaveGame.label(d) + '</small>';
  }
  function showStory(kicker, title, paras, objectives, btn) {
    $('storyKicker').textContent = kicker; $('storyTitle').textContent = title;
    $('storyText').innerHTML = paras.map(p => `<p>${p}</p>`).join('') + (objectives ? `<div class="sobj"><b>Objectives</b>${objectives.map(o => `<div>${o.optional ? '◇' : '◆'} ${o.text}${o.optional ? ' <i>(optional)</i>' : ''}</div>`).join('')}</div>` : '');
    $('storyGo').textContent = btn || 'Begin';
    open('story');
  }
  return { init, open, close, sub, back, showEnd, showStory, renderChapters, refreshContinue, openChronicle };
})();

// =====================================================================
//  STORY — campaign intro, objectives tracker, narrative beats
// =====================================================================
const Story = (() => {
  let ch = null, done = {}, beats = new Set(), t = 0, seen = {};
  function check(id) {
    const p = players[HUMAN], st = p.stats;
    switch (id) {
      case 'feudal': return p.age >= 1;
      case 'iron': return p.age >= 2;
      case 'treasure': return (st.treasures || 0) >= 1;
      case 'treasure2': case 'graves': return (st.treasures || 0) >= 2;
      case 'captain': case 'tyrant': return (st.bosses || 0) >= 1;
      case 'gold1500': return st.gathered.gold >= 1500;
      case 'army12': return units.filter(u => u.owner === HUMAN && !u.dead && isMil(u)).length >= 12;
      case 'siege3': return units.filter(u => u.owner === HUMAN && !u.dead && UNITS[u.type].cls === 'siege').length >= 3;
      case 'towers2': return buildings.filter(b => b.owner === HUMAN && !b.dead && b.built && (b.type === 'tower' || b.type === 'belltower')).length >= 2;
      case 'tc3': return buildings.some(b => b.owner === HUMAN && !b.dead && b.type === 'towncenter' && (b.level || 1) >= 3);
      case 'win': case 'winOrWonder': return players[AIP] && players[AIP].alive === false;
    }
    return false;
  }
  function render() {
    const el = $('objectives');
    if (!ch) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="oh">Chapter ${ch.num}: ${ch.title}</div>` + ch.objectives.map(o => `<div class="oi ${done[o.id] ? 'ok' : ''} ${o.optional ? 'opt' : ''}">${done[o.id] ? '✔' : o.optional ? '◇' : '◆'} ${o.text}</div>`).join('');
  }
  function beat(text) { UI.notify(text, 'story', 'beat' + text.length + text.charCodeAt(5)); }
  function begin(chapter, st) {
    ch = chapter; done = {}; beats = new Set(); t = 0; seen = {};
    if (st) { done = st.done || {}; beats = new Set(st.beats || []); seen = st.seen || {}; }
    render();
    if (ch && !st) { Game.paused = true; Menus.showStory(campaignOf(ch).title + ' · Chapter ' + ch.num + ' · ' + MAP_THEMES[ch.theme].name, ch.title, ch.intro, ch.objectives, 'Begin'); }
  }
  function event(name) {
    if (!ch || seen[name]) return; seen[name] = true;
    ch.beats.forEach((b, i) => { if (b.event === name && !beats.has(i)) { beats.add(i); beat(b.text); } });
  }
  function tick(dt) {
    if (!ch || Game.mode !== 'play' || Game.over) return;
    t -= dt; if (t > 0) return; t = 1;
    for (const o of ch.objectives) if (!done[o.id] && check(o.id)) { done[o.id] = true; render(); if (o.id !== 'win' && o.id !== 'winOrWonder') { const p = players[HUMAN]; if (o.optional) { p.res.food += 300; p.res.gold += 300; } else { p.res.food += 150; p.res.wood += 150; } UI.notify((o.optional ? 'Bonus objective complete: ' : 'Objective complete: ') + o.text + (o.optional ? '  (+300 food, +300 gold)' : '  (+150 food, +150 wood)'), 'good', 'obj' + o.id); Sound.play('fanfare'); } }
    if (players[HUMAN].age >= 1) event('feudal');
    if (players[HUMAN].age >= 2) event('iron');
    ch.beats.forEach((b, i) => { if (b.at !== undefined && Game.time >= b.at && !beats.has(i)) { beats.add(i); beat(b.text); } });
  }
  function summaryHTML() {
    if (!ch) return '';
    for (const o of ch.objectives) if (!done[o.id] && check(o.id)) done[o.id] = true;
    return ch.objectives.map(o => `<div class="${done[o.id] ? 'ok' : 'no'}">${done[o.id] ? '✔' : '✖'} ${o.text}${o.optional ? ' (optional)' : ''}</div>`).join('');
  }
  return { begin, tick, event, summaryHTML, state() { return { done, beats: [...beats], seen }; }, get chapter() { return ch; } };
})();
