// =====================================================================
//  EXTRAS — save / load, tutorial tips, automatic graphics quality
// =====================================================================
function packBits(a) { const n = Math.ceil(a.length / 8), u = new Uint8Array(n); for (let i = 0; i < a.length; i++) if (a[i]) u[i >> 3] |= 1 << (i & 7); let s = ''; for (let i = 0; i < n; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unpackBits(s, out) { const b = atob(s); for (let i = 0; i < out.length; i++) out[i] = (b.charCodeAt(i >> 3) >> (i & 7)) & 1; }

const SaveGame = {
  KEY: 'ironvale.save',
  SLOTS: ['auto', '1', '2', '3'],
  key(slot) { return slot && slot !== 'auto' ? this.KEY + '.' + slot : this.KEY; },
  info(slot) { try { const d = JSON.parse(localStorage.getItem(this.key(slot)) || 'null'); return d && d.v === 1 ? d : null; } catch (e) { return null; } },
  clear(slot) { try { localStorage.removeItem(this.key(slot)); } catch (e) { /* ignore */ } },
  // the most recent save in any slot
  latest() { let best = null; for (const s of this.SLOTS) { const d = this.info(s); if (d && (!best || d.when > best.when)) { best = d; best.slot = s; } } return best; },
  label(d) { const ch = d.opts.chapter && CAMPAIGN.find(c => c.id === d.opts.chapter); return (ch ? 'Chapter ' + ch.num + ' · ' : (FACTIONS[d.opts.pf] ? FACTIONS[d.opts.pf].name + ' · ' : '')) + (MAP_THEMES[d.opts.theme] || MAP_THEMES.vale).name + ' · ' + fmtTime(d.time) + ' played'; },
  save(silent, slot) {
    if (Game.mode !== 'play' || Game.over || Game.busy || players[HUMAN].isAI) return false;
    const round = v => Math.round(v * 100) / 100;
    const data = {
      v: 1, when: Date.now(), opts: Object.assign({}, Game.lastOpts, { restore: null }), time: Game.time,
      players: [0, 1].map(i => { const p = players[i]; return { res: p.res, age: p.age, techs: [...p.techs], stats: p.stats, exp: packBits(p.exp), gatherMul: p.gatherMul }; }),
      removed: World.removed || [],
      amounts: resources.filter(r => !r.dead && r.rtype !== 'carcass' && r.amount < r.max - 0.5).map(r => [r.tx, r.ty, Math.round(r.amount)]),
      buildings: buildings.filter(b => !b.dead).map(b => ({ t: b.type, o: b.owner, x: b.tx, y: b.ty, built: b.built, pr: round(b.progress), hp: Math.round(b.hp), lv: b.level || 1, va: b.variant || 0, am: Math.round(b.amount || 0), wt: b.wonderT, seen: !!b.seenBy0,
        rally: b.rally ? { x: round(b.rally.x), z: round(b.rally.z) } : null, q: b.queue.map(q => ({ kind: q.kind, id: q.id, t: round(q.t), total: q.total, cost: q.cost, started: !!q.started })) })),
      units: units.filter(u => !u.dead).map(u => ({ t: u.type, o: u.owner, x: round(u.x), z: round(u.z), hp: round(u.hp), c: round(u.carry || 0), ct: u.carryType, hx: round(u.home.x), hz: round(u.home.z), pk: !!u.parked })),
      ai: (() => { const a = AIs.find(a => a.pid === AIP); return a ? { wave: a.wave, attackT: a.attackT } : null; })(),
      cam: { x: Cam.x, z: Cam.z }, story: Story.state(),
    };
    try { localStorage.setItem(this.key(slot), JSON.stringify(data)); } catch (e) { if (!silent) UI.notify('Could not save: browser storage is full or blocked', 'warn'); return false; }
    if (!silent) { UI.notify(slot && slot !== 'auto' ? 'Game saved to slot ' + slot : 'Game saved', 'good', 'saved'); Sound.play('done'); }
    return true;
  },
  async load(slot) {
    const d = this.info(slot); if (!d) return false;
    await Game.start(Object.assign({}, d.opts, { restore: d }));
    return true;
  },
  // rebuild the saved world on top of a freshly generated (bare) map
  apply(d) {
    Game.time = d.time;
    const byKey = new Map(); for (const r of resources) if (r.rtype !== 'carcass') byKey.set(r.tx + ',' + r.ty, r);
    for (const k of d.removed) { const r = byKey.get(k); if (r) removeResource(r); }
    World.removed = d.removed.slice();
    for (const [x, y, a] of d.amounts) { const r = byKey.get(x + ',' + y); if (!r || r.dead) continue; r.amount = a; if (r.rtype === 'tree') { r.felled = true; r.fallDir = r.rot; r.fall = 1; } setResInstance(r, true); }
    d.players.forEach((s, i) => {
      const p = players[i]; Object.assign(p.res, s.res); p.age = s.age; p.gatherMul = s.gatherMul || 1; p.stats = s.stats;
      for (const t of s.techs) { p.techs.add(t); if (TECHS[t] && TECHS[t].apply) TECHS[t].apply(p); } p.ver++;
      unpackBits(s.exp, p.exp);
    });
    for (const s of d.buildings) {
      const b = createBuilding(s.t, s.o, s.x, s.y, s.built);
      b.variant = s.va; b.level = s.lv; b.maxHp = Math.round(BUILDINGS[s.t].hp * (players[s.o].mod.bldHp || 1)) + Math.round(BUILDINGS[s.t].hp * 0.25) * (s.lv - 1);
      b.progress = s.pr; b.hp = Math.min(b.maxHp, s.hp); b.amount = s.am; b.rally = s.rally; b.seenBy0 = s.seen; if (s.wt !== undefined && s.wt !== null) b.wonderT = s.wt;
      b.queue = s.q.map(q => Object.assign({}, q)); for (const q of b.queue) if (q.kind === 'tech') players[s.o].researching.add(q.id);
      View.refreshBuilding(b);
      if (b.inner) b.inner.scale.setScalar(b.built ? 1 + 0.05 * (s.lv - 1) : 1);
    }
    for (const s of d.units) {
      if (!UNITS[s.t]) continue;
      const u = spawnUnit(s.t, s.o, s.x, s.z); u.hp = Math.min(u.maxHp, s.hp); u.carry = s.c; u.carryType = s.ct; u.home = { x: s.hx, z: s.hz }; u.parked = s.pk;
      if (s.t === 'villager' && s.o <= 1) u.hp = Math.min(ustat(s.o, 'villager').hp, s.hp), u.maxHp = ustat(s.o, 'villager').hp;
    }
    const ai = AIs.find(a => a.pid === AIP); if (ai && d.ai) { ai.wave = d.ai.wave; ai.attackT = Math.max(d.ai.attackT, d.time + 30); }
    Cam.x = d.cam.x; Cam.z = d.cam.z;
  },
};

// ---------------- growth boost: faster gathering, building, training and research for the player ----------------
const Boost = {
  LEVELS: [1, 2, 4],
  set(v, silent) {
    v = this.LEVELS.includes(+v) ? +v : 1;
    players[HUMAN].boost = v; if (Game.lastOpts) Game.lastOpts.boost = v;
    const el = $('btnBoost'); if (el) { const small = window.innerWidth < 900 || window.innerHeight < 560; el.textContent = v > 1 ? (small ? '⚡' + v + 'x' : '⚡ BOOST ' + v + 'x') : (small ? '⚡ off' : '⚡ Boost off'); el.classList.toggle('on', v > 1); }
    if (!silent) UI.notify(v > 1 ? 'Growth boost ' + v + 'x: you gather, build, train and research ' + v + ' times faster' : 'Growth boost off', v > 1 ? 'good' : '', 'boost');
  },
  cycle() { if (Game.mode !== 'play' || Game.over) return; const i = this.LEVELS.indexOf(players[HUMAN].boost || 1); this.set(this.LEVELS[(i + 1) % this.LEVELS.length]); Sound.play('click'); },
};
document.addEventListener('click', e => { if (e.target && e.target.id === 'btnBoost') Boost.cycle(); });
// on phones the camera panel starts folded away so it does not cover the map
window.addEventListener('load', () => { const v = $('viewctl'), h = $('vHide'); if (v && h && (window.innerWidth < 900 || window.innerHeight < 560)) { v.classList.add('min'); h.textContent = '+'; } });

// ---------------- save slots window (save from the pause menu, load from the pause or main menu) ----------------
const Slots = (() => {
  let el = null, mode = 'load', sure = null;
  function ensure() {
    if (el) return;
    el = document.createElement('div'); el.id = 'slots'; el.className = 'screen hidden'; el.style.background = 'rgba(0,0,0,.6)';
    el.innerHTML = '<div class="card" style="width:min(460px,100%)"><h2 id="slTitle" style="text-align:center"></h2><div id="slList"></div><div class="mstack" style="margin-top:10px"><button class="lbtn" id="slBack">Back</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('#slBack').onclick = hide;
    el.querySelector('#slList').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const slot = b.dataset.slot, act = b.dataset.act;
      if (act === 'save') { if (SaveGame.info(slot) && sure !== 's' + slot) { sure = 's' + slot; return render(); } SaveGame.save(false, slot); sure = null; render(); }
      else if (act === 'del') { if (sure !== 'd' + slot) { sure = 'd' + slot; return render(); } SaveGame.clear(slot); sure = null; render(); if (typeof Menus !== 'undefined') Menus.refreshContinue(); }
      else if (act === 'load') { hide(); $('pause').classList.add('hidden'); Sound.init(); Sound.play('click'); await SaveGame.load(slot); }
    };
  }
  function render() {
    el.querySelector('#slTitle').textContent = mode === 'save' ? 'Save Game' : 'Load Game';
    el.querySelector('#slList').innerHTML = SaveGame.SLOTS.filter(s => mode === 'load' || s !== 'auto').map(s => {
      const d = SaveGame.info(s), name = s === 'auto' ? 'Autosave' : 'Slot ' + s;
      const when = d ? new Date(d.when).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const btns = mode === 'save' ? `<button class="lbtn" data-act="save" data-slot="${s}">${sure === 's' + s ? 'Overwrite?' : 'Save here'}</button>`
        : (d ? `<button class="lbtn" data-act="load" data-slot="${s}">Load</button><button class="lbtn slx" data-act="del" data-slot="${s}" title="Delete this save">${sure === 'd' + s ? 'Sure?' : '✕'}</button>` : '');
      return `<div class="slrow${d ? '' : ' empty'}"><div class="slinfo"><b>${name}</b><span>${d ? SaveGame.label(d) : 'Empty'}</span>${d ? '<i>' + when + '</i>' : ''}</div><div class="slbtn">${btns}</div></div>`;
    }).join('');
  }
  function show(m) { ensure(); mode = m; sure = null; render(); el.classList.remove('hidden'); }
  function hide() { if (el) el.classList.add('hidden'); }
  return { show, hide, isOpen: () => !!el && !el.classList.contains('hidden') };
})();

// ---------------- tutorial tips ----------------
const Tips = (() => {
  let i = 0, t = 0, active = false;
  const P = () => players[HUMAN];
  const count = f => units.filter(u => u.owner === HUMAN && !u.dead && f(u)).length;
  const has = (type, built = true) => buildings.some(b => b.owner === HUMAN && !b.dead && b.type === type && (!built || b.built));
  const STEPS = [
    { text: '<b>Train villagers.</b> Click your Town Center (the big hall), then click the villager button or press <b>R</b>. Villagers are your workers.', done: () => count(u => u.type === 'villager') >= 5 },
    { text: '<b>Gather.</b> With AUTO-WORK on, villagers find work themselves. You can also select one and <b>right-click</b> a tree, berry bush, animal or gold rock.', done: () => RESN.reduce((a, r) => a + P().stats.gathered[r], 0) >= 80 },
    { text: '<b>Build a House.</b> Select a villager and press <b>R</b>, then click the ground. Each house lets you have 5 more people.', done: () => has('house') || has('yurt') },
    { text: '<b>Build a Lumber Camp (T)</b> near trees and a <b>Mill (U)</b> near berries. You need two such buildings to reach the next age.', done: () => eligibleQualify(HUMAN, 0) >= 2 || P().age >= 1 },
    { text: '<b>Advance to the Feudal Age.</b> Save 400 food, select the Town Center and press <b>H</b>. This unlocks soldiers.', done: () => P().age >= 1 },
    { text: '<b>Raise an army.</b> Have a villager build a <b>Barracks (F)</b>, then train soldiers there. Spearmen beat cavalry, archers beat infantry, cavalry beats archers.', done: () => count(isMil) >= 4 },
    { text: '<b>Attack!</b> Press the red <b>⚔ ATTACK</b> button (top right) to send every idle soldier at the enemy. Destroy all their buildings to win.', done: () => P().stats.bldDestroyed > 0 || P().stats.kills >= 3 },
    { text: '<b>Well done!</b> Tips: upgrade buildings for more HP, train Herbalists to heal, and clear wild camps for treasure. Press ✕ to close.', done: () => false },
  ];
  function render() {
    const el = $('tips');
    if (!active || i >= STEPS.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="th"><span>Guide · step ${i + 1} of ${STEPS.length}</span><button id="tipX" title="Hide tips (turn back on in Settings)">✕</button></div><div class="tt2">${STEPS[i].text}</div>`;
    $('tipX').onclick = () => { Settings.tips = false; saveSettings(); active = false; render(); };
  }
  function begin() { i = 0; t = 2; active = Settings.tips !== false && !players[HUMAN].isAI; while (active && i < STEPS.length - 1 && STEPS[i].done()) i++; render(); }
  function tick(dt) {
    if (!active || Game.mode !== 'play') return;
    t -= dt; if (t > 0) return; t = 1;
    if (i < STEPS.length && STEPS[i].done()) { i++; Sound.play('done'); render(); }
  }
  return { begin, tick, hide() { active = false; render(); } };
})();

// ---------------- frame-rate watchdog + autosave ----------------
const Extras = (() => {
  let slowT = 0, saveT = 0, lowRes = false;
  function tick(dt) {
    if (Game.mode !== 'play' || Game.paused || Game.over) return;
    saveT += dt;
    if (saveT > 120) { saveT = 0; SaveGame.save(true); }
    if (Settings.autoQuality === false || !document.hasFocus() || document.visibilityState !== 'visible' || !Game.fps) return;
    if (Game.fps < 26) slowT += dt; else slowT = Math.max(0, slowT - dt * 2);
    if (slowT > 7) {
      slowT = 0;
      if (Settings.quality === 'high') { Settings.quality = 'medium'; applyQuality(); UI.notify('Graphics lowered to Medium to keep the game smooth', '', 'autoq'); }
      else if (Settings.quality === 'medium') { Settings.quality = 'low'; applyQuality(); UI.notify('Graphics lowered to Low to keep the game smooth', '', 'autoq'); }
      else if (!lowRes) { lowRes = true; renderer.setPixelRatio(0.7); onResize(); UI.notify('Resolution reduced to keep the game smooth', '', 'autoq'); }
    }
  }
  return { tick, reset() { slowT = 0; saveT = 0; } };
})();
