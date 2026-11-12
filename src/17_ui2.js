// =====================================================================
//  UI EXTRAS — event log, production strip, tech tree, group badges,
//  villager tasks, minimap tools, hotkey editor, end-game graph,
//  rotating portrait, UI scale, hover sounds
// =====================================================================
const UI2 = (() => {
  let t = 0, log = [], logSig = '', timeline = [], lastSample = -1, prodSig = '', grpSig = '', portT = 0, portAng = 0, hoverT = 0;
  const mk = (tag, attrs, html) => { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html !== undefined) e.innerHTML = html; return e; };
  const H = () => players[HUMAN];
  const NAMES = { cavalry: 'Cavalry', archer: 'Archers', infantry: 'Infantry', siege: 'Siege', building: 'Buildings', villager: 'Villagers' };
  const WEAK = { infantry: 'Archers', archer: 'Cavalry', cavalry: 'Spearmen', siege: 'Melee units', villager: 'All soldiers', support: 'All soldiers' };
  function counterHTML(type) {
    const d = UNITS[type]; if (!d || d.cls === 'animal' || d.cls === 'creep') return '';
    const strong = Object.keys(d.bonus || {}).filter(k => d.bonus[k] >= 3 && NAMES[k]).map(k => NAMES[k]);
    return `<div class="ctr">${strong.length ? `<span class="good">▲ Strong vs ${strong.join(', ')}</span>` : ''}${WEAK[d.cls] ? `<span class="bad">▼ Weak vs ${WEAK[d.cls]}</span>` : ''}${d.heal ? '<span class="good">✚ Heals nearby units</span>' : ''}</div>`;
  }

  // ---------------- event log ----------------
  function hookNotify() {
    const orig = UI.notify;
    UI.notify = (text, cls, key, pos) => {
      orig(text, cls, key);
      if (Game.mode !== 'play' || /^Click |^Place |^Group |^Time of day|^Weather|^Game saved/.test(text)) return;
      const last = log.find(l => l.text === text); if (last && Game.time - last.time < 12) return;
      log.unshift({ text, cls: cls || '', time: Game.time, pos: pos || null }); if (log.length > 60) log.pop();
      $('btnLog').classList.add('hot'); setTimeout(() => $('btnLog').classList.remove('hot'), 1500);
    };
  }
  function renderLog() {
    const p = $('logPanel'); if (p.classList.contains('hidden')) return;
    const sig = log.length + ':' + (log[0] ? log[0].time : 0); if (sig === logSig) return; logSig = sig;
    p.innerHTML = '<div class="ph">Event log<button id="logX">✕</button></div>' + (log.length ? log.map((l, i) => `<div class="le ${l.cls} ${l.pos ? 'go' : ''}" data-i="${i}"><b>${fmtTime(l.time)}</b> ${l.text}${l.pos ? ' <i>➜</i>' : ''}</div>`).join('') : '<div class="le">Nothing has happened yet.</div>');
    $('logX').onclick = () => p.classList.add('hidden');
    p.querySelectorAll('.le.go').forEach(e => e.onclick = () => { const l = log[+e.dataset.i]; camJump(l.pos.x, l.pos.z); Minimap.ping(l.pos.x, l.pos.z); });
  }

  // ---------------- production strip ----------------
  function renderProd() {
    const list = buildings.filter(b => b.owner === HUMAN && !b.dead && (b.queue.length || !b.built) && b.type !== 'wall' && b.type !== 'farm').slice(0, 9);
    const sig = list.map(b => b.id + ':' + (b.built ? b.queue[0].id + b.queue.length + ((b.queue[0].t / b.queue[0].total * 20) | 0) : 'c' + ((b.progress * 20) | 0))).join('|');
    if (sig === prodSig) return; prodSig = sig;
    const bar = $('prodbar'); bar.classList.toggle('hidden', !list.length);
    bar.innerHTML = list.map(b => {
      const q = b.queue[0];
      const icon = !b.built ? View.ICONS['b_' + b.type] : q.kind === 'unit' ? View.ICONS[q.id] : q.kind === 'upgrade' ? glyph('age2') : glyph(TECHS[q.id].icon);
      const pr = !b.built ? b.progress : q.t / q.total;
      const what = !b.built ? 'Building ' + BUILDINGS[b.type].name : q.kind === 'unit' ? 'Training ' + UNITS[q.id].name : q.kind === 'upgrade' ? 'Upgrading ' + BUILDINGS[b.type].name : TECHS[q.id].name;
      return `<div class="pi" data-id="${b.id}" title="${what} — click to select" style="background-image:url(${icon})">${b.built && b.queue.length > 1 ? `<span>×${b.queue.length}</span>` : ''}<div class="pp"><div style="width:${pr * 100}%"></div></div></div>`;
    }).join('');
    bar.querySelectorAll('.pi').forEach(e => e.onclick = () => { const b = ents.get(+e.dataset.id); if (b) { Input.setSelection([b]); camJump(b.x, b.z); } });
  }

  // ---------------- control-group badges ----------------
  function renderGroups() {
    const g = Input.groups, items = [];
    for (let n = 1; n <= 9; n++) { const c = (g[n] || []).filter(id => { const e = ents.get(id); return e && !e.dead; }).length; if (c) items.push([n, c]); }
    const sig = items.join('|'); if (sig === grpSig) return; grpSig = sig;
    const bar = $('grpbar'); bar.classList.toggle('hidden', !items.length);
    bar.innerHTML = items.map(([n, c]) => `<button data-n="${n}" title="Select group ${n} (press ${n})"><b>${n}</b>${c}</button>`).join('');
    bar.querySelectorAll('button').forEach(e => e.onclick = () => Input.recallGroup(+e.dataset.n));
  }

  // ---------------- villager tasks ----------------
  const TASKS = [['food', 'Food'], ['wood', 'Wood'], ['stone', 'Stone'], ['gold', 'Gold'], ['build', 'Building'], ['idle', 'Idle']];
  const taskOf = u => u.state === 'build' ? 'build' : (u.state === 'gather' || u.state === 'return') && u.gres ? u.gres : u.state === 'idle' ? 'idle' : 'other';
  const myVils = () => units.filter(u => u.owner === HUMAN && u.type === 'villager' && !u.dead && !u.garrisonIn);
  function assign(res) {
    const vs = myVils(); let u = vs.find(v => taskOf(v) === 'idle');
    if (!u) { const cnt = {}; for (const v of vs) cnt[taskOf(v)] = (cnt[taskOf(v)] || 0) + 1; const from = RESN.filter(r => r !== res).sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0]; u = vs.find(v => taskOf(v) === from && v.carry < 3) || vs.find(v => taskOf(v) === from); }
    if (!u) { UI.notify('No villager available', 'warn', 'novil'); return; }
    const tc = buildings.find(b => b.owner === HUMAN && b.type === 'towncenter' && !b.dead) || u;
    const probe = { x: tc.x, z: tc.z, owner: HUMAN, id: u.id, bad: null };
    let tgt = null;
    for (const kind of (res === 'food' ? ['berry', 'hunt', 'farm'] : res === 'wood' ? ['tree'] : [res])) { tgt = findGatherTarget(probe, kind, 45); if (tgt) break; }
    if (!tgt) { UI.notify('No ' + res + ' source found nearby', 'warn', 'nosrc'); return; }
    u.parked = false; orderGather(u, tgt); Sound.play('click'); renderVil(true);
  }
  function renderVil(force) {
    const p = $('vilPop'); if (p.classList.contains('hidden') && !force) return;
    const vs = myVils(), cnt = {}; for (const v of vs) cnt[taskOf(v)] = (cnt[taskOf(v)] || 0) + 1;
    p.innerHTML = '<div class="ph">Villagers · ' + vs.length + '<button id="vilX">✕</button></div>' + TASKS.map(([k, n]) => `<div class="vr"><span class="vn">${RESN.includes(k) ? `<i style="background-image:url(${resIcon(k)})"></i>` : ''}${n}</span><b>${cnt[k] || 0}</b><button data-sel="${k}" title="Select these villagers">Select</button>${RESN.includes(k) ? `<button data-add="${k}" title="Send one more villager to gather ${n.toLowerCase()}">+1</button>` : '<span class="sp"></span>'}</div>`).join('');
    $('vilX').onclick = () => p.classList.add('hidden');
    p.querySelectorAll('[data-sel]').forEach(e => e.onclick = () => { const l = myVils().filter(v => taskOf(v) === e.dataset.sel); if (l.length) { Input.setSelection(l); Input.centerSel(); } });
    p.querySelectorAll('[data-add]').forEach(e => e.onclick = () => assign(e.dataset.add));
  }

  // ---------------- tech tree ----------------
  function openTech() {
    const p = H(), have = t2 => buildings.some(b => b.owner === HUMAN && b.type === t2 && b.built && !b.dead);
    const where = (key, field) => { for (const b in BUILDINGS) if ((BUILDINGS[b][field] || []).includes(key)) return BUILDINGS[b].name; return ''; };
    const cost = c => Object.keys(c || {}).map(r => c[r] + ' ' + r).join(', ');
    const card = (icon, name, st, tip) => `<div class="tn ${st}" title="${tip.replace(/"/g, '&quot;')}"><i style="background-image:url(${icon})"></i><span>${name}</span>${st === 'have' ? '<em>✔</em>' : st === 'lock' ? '<em>🔒</em>' : ''}</div>`;
    let html = '';
    for (let a = 0; a < 3; a++) {
      const bl = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].age === a && realmOk(BUILDINGS[k], p)).map(k => card(View.ICONS['b_' + k], BUILDINGS[k].name, have(k) ? 'have' : p.age >= a ? 'avail' : 'lock', BUILDINGS[k].desc + ' — ' + cost(BUILDINGS[k].cost))).join('');
      const ul = Object.keys(UNITS).filter(k => UNITS[k].age === a && realmOk(UNITS[k], p) && UNITS[k].cls !== 'animal' && UNITS[k].cls !== 'creep').map(k => card(View.ICONS[k], UNITS[k].name, units.some(u => u.owner === HUMAN && u.type === k && !u.dead) ? 'have' : p.age >= a ? 'avail' : 'lock', UNITS[k].desc + ' — ' + cost(UNITS[k].cost) + ' — trained at ' + where(k, 'trains'))).join('');
      const tl = Object.keys(TECHS).filter(k => TECHS[k].age === a).map(k => card(glyph(TECHS[k].icon), TECHS[k].name.replace('Advance to ', '→ '), p.techs.has(k) ? 'have' : p.age >= a && (!TECHS[k].req || p.techs.has(TECHS[k].req)) ? 'avail' : 'lock', TECHS[k].desc + ' — ' + cost(TECHS[k].cost) + ' — at ' + where(k, 'techs'))).join('');
      html += `<div class="tcol ${p.age === a ? 'cur' : p.age > a ? 'past' : ''}"><h3>${AGE_NAMES[a]}${p.age === a ? ' <small>(current)</small>' : ''}</h3><h4>Buildings</h4><div class="tg">${bl}</div><h4>Units</h4><div class="tg">${ul}</div><h4>Upgrades</h4><div class="tg">${tl}</div></div>`;
    }
    $('techBody').innerHTML = html;
    Menus.sub('techtree');
  }

  // ---------------- hotkey editor ----------------
  const HK_DEFAULT = HOTKEYS.slice();
  function openHotkeys() {
    const g = $('hkGrid'); g.innerHTML = HOTKEYS.map((k, i) => `<input maxlength="1" data-i="${i}" value="${k}">`).join('');
    g.querySelectorAll('input').forEach(inp => { inp.onfocus = () => inp.select(); inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); $('hkMsg').textContent = ''; }; });
    $('hkMsg').textContent = ''; Menus.sub('hotkeys');
  }
  function saveHotkeys() {
    const vals = [...$('hkGrid').querySelectorAll('input')].map(i => i.value);
    if (vals.some(v => !v)) return $('hkMsg').textContent = 'Every slot needs a letter.';
    if (vals.some(v => 'WASDQEPM'.includes(v))) return $('hkMsg').textContent = 'W A S D Q E P M are used by the camera and menus.';
    if (new Set(vals).size !== vals.length) return $('hkMsg').textContent = 'Each letter can only be used once.';
    vals.forEach((v, i) => HOTKEYS[i] = v); Settings.hotkeys = vals; saveSettings(); UI.selChanged(); Menus.back();
  }

  // ---------------- end-of-game graph ----------------
  function sample() {
    if (Game.time < lastSample) { timeline = []; lastSample = -1; log = []; logSig = ''; }
    if (Game.time - lastSample < 15) return; lastSample = Game.time;
    const row = { t: Game.time };
    for (const i of [0, 1]) { row['a' + i] = units.filter(u => u.owner === i && !u.dead && isMil(u)).length; row['r' + i] = RESN.reduce((a, r) => a + players[i].stats.gathered[r], 0); }
    timeline.push(row);
  }
  function drawChart() {
    const cv = $('endChart'), g = cv.getContext('2d'), W = cv.width, Hh = cv.height;
    g.clearRect(0, 0, W, Hh);
    if (timeline.length < 2) { cv.classList.add('hidden'); return; } cv.classList.remove('hidden');
    const tMax = timeline[timeline.length - 1].t;
    const plot = (x0, w, keys, title) => {
      const max = Math.max(1, ...timeline.map(r => Math.max(r[keys[0]], r[keys[1]])));
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, 18, w, Hh - 34); g.strokeStyle = 'rgba(240,212,138,.35)'; g.strokeRect(x0 + .5, 18.5, w - 1, Hh - 35);
      g.fillStyle = '#f0d48a'; g.font = 'bold 11px Georgia'; g.fillText(title + ' (max ' + Math.round(max) + ')', x0 + 2, 12);
      keys.forEach((k, i) => { g.beginPath(); timeline.forEach((r, n) => { const x = x0 + 4 + (r.t / tMax) * (w - 8), y = Hh - 20 - (r[k] / max) * (Hh - 44); n ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = TEAM_CSS[i]; g.lineWidth = 2; g.stroke(); });
      g.fillStyle = '#9b9586'; g.font = '10px sans-serif'; g.fillText('0:00', x0 + 2, Hh - 4); g.fillText(fmtTime(tMax), x0 + w - 30, Hh - 4);
    };
    plot(0, W / 2 - 6, ['a0', 'a1'], 'Army size'); plot(W / 2 + 6, W / 2 - 6, ['r0', 'r1'], 'Resources gathered');
  }

  // ---------------- rotating 3D portrait ----------------
  let pScene, pCam, pRT, pBuf, pCtx, pObjs = [], pKey = '';
  function portrait(dt) {
    const cv = $('portCanvas'), s = Input.selection();
    const e = s.length === 1 && !s[0].dead ? s[0] : null;
    let geos = null, key = '';
    if (e && e.kind === 'unit') { const n = e.charModel; if (n && CHARS[n]) { geos = [[CHARS[n].idle, MAT.vc]]; key = 'u' + n; } }
    else if (e && e.kind === 'building') { const md = buildingModel(e.type, players[e.owner].age, e.variant || 0, players[e.owner].faction); geos = [[md.base, MAT.vc]]; if (md.team) geos.push([md.team, MAT.team[e.owner]]); key = 'b' + e.type + players[e.owner].age + (e.variant || 0) + e.owner + (players[e.owner].faction || ''); }
    if (!geos || Settings.quality === 'low') { cv.classList.add('hidden'); $('portrait').classList.remove('live'); pKey = ''; return; }
    portT -= dt; if (portT > 0) return; portT = 0.07; portAng += 0.05;
    if (!pScene) {
      pScene = new THREE.Scene(); pScene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 0.95)); const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 5, 4); pScene.add(dl);
      pCam = new THREE.PerspectiveCamera(28, 1, 0.1, 100); pRT = new THREE.WebGLRenderTarget(112, 112); pRT.texture.encoding = THREE.sRGBEncoding; pBuf = new Uint8Array(112 * 112 * 4); pCtx = cv.getContext('2d');
    }
    if (key !== pKey) {
      pKey = key; for (const o of pObjs) pScene.remove(o); pObjs = geos.map(([g, m]) => { const o = new THREE.Mesh(g, m); pScene.add(o); return o; });
      const g0 = geos[0][0]; if (!g0.boundingBox) g0.computeBoundingBox(); const bb = g0.boundingBox, hh = bb.max.y - bb.min.y, ww = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), r = Math.max(hh, ww);
      pCam.userData = { d: r * 2.5 + 0.4, y: bb.min.y + hh * 0.5 };
    }
    for (const o of pObjs) o.rotation.y = portAng;
    const { d, y } = pCam.userData; pCam.position.set(0, y + d * 0.35, d); pCam.lookAt(0, y, 0);
    const fog = U.uFog.value, day = U.uDay.value, snow = U.uSnow.value, cc = renderer.getClearColor(new THREE.Color()).getHex(), ca = renderer.getClearAlpha();
    U.uFog.value = whiteTex; U.uDay.value = 0; U.uSnow.value = 0;
    renderer.setRenderTarget(pRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(pScene, pCam);
    renderer.readRenderTargetPixels(pRT, 0, 0, 112, 112, pBuf); renderer.setRenderTarget(null); renderer.setClearColor(cc, ca);
    U.uFog.value = fog; U.uDay.value = day; U.uSnow.value = snow;
    const img = pCtx.createImageData(112, 112); for (let yy = 0; yy < 112; yy++) img.data.set(pBuf.subarray((111 - yy) * 448, (112 - yy) * 448), yy * 448);
    pCtx.putImageData(img, 0, 0); cv.classList.remove('hidden'); $('portrait').classList.add('live');
  }

  function applyScale() { $('hud').style.zoom = (Settings.uiScale || 100) / 100; }
  function init() {
    document.body.appendChild($('selbox'));
    if (Array.isArray(Settings.hotkeys) && Settings.hotkeys.length === HOTKEYS.length) Settings.hotkeys.forEach((v, i) => HOTKEYS[i] = v);
    hookNotify(); applyScale();
    $('btnLog').onclick = () => { $('logPanel').classList.toggle('hidden'); logSig = ''; renderLog(); };
    $('btnTech').onclick = () => { Sound.init(); openTech(); };
    $('techBack').onclick = () => Menus.back();
    $('r-pop').style.cursor = 'pointer'; $('r-pop').onclick = () => { $('vilPop').classList.toggle('hidden'); renderVil(true); };
    $('setHotkeys').onclick = () => openHotkeys(); $('hkSave').onclick = saveHotkeys; $('hkCancel').onclick = () => Menus.back();
    $('hkReset').onclick = () => { $('hkGrid').querySelectorAll('input').forEach((inp, i) => inp.value = HK_DEFAULT[i]); };
    $('setScale').value = Settings.uiScale || 100; $('setScale').oninput = () => { Settings.uiScale = +$('setScale').value; saveSettings(); applyScale(); };
    const cb = $('setCB'); const setCB = () => cb.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!Settings.colorblind)); setCB();
    cb.querySelectorAll('button').forEach(b => b.onclick = () => { Settings.colorblind = b.dataset.v === '1'; saveSettings(); setCB(); if (Game.mode === 'menu') location.reload(); else UI.notify('Team colours change the next time the game is opened', '', 'cb'); });
    // minimap tools
    $('mmRes').onclick = e => { e.stopPropagation(); Minimap.opts.res = !Minimap.opts.res; e.target.classList.toggle('off', !Minimap.opts.res); Minimap.dirty = true; };
    $('mmUnits').onclick = e => { e.stopPropagation(); Minimap.opts.units = !Minimap.opts.units; e.target.classList.toggle('off', !Minimap.opts.units); };
    $('mmBig').onclick = e => { e.stopPropagation(); $('mmwrap').classList.toggle('big'); };
    $('btmToggle').onclick = () => { document.body.classList.toggle('btmmin'); $('btmToggle').textContent = document.body.classList.contains('btmmin') ? '▲' : '▼'; };
    // soft tick when the pointer enters a button
    document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('.cb:not(.empty),.lbtn,.big,.tbtn,.seg button,#viewctl button,.chap .cplay'); if (!b || b === hoverT) return; hoverT = b; Sound.play('click', undefined, undefined, 0.18); });
    const orig = Menus.showEnd; Menus.showEnd = (win, reason) => { orig(win, reason); drawChart(); };
  }
  function tick(dt) {
    if (Game.mode !== 'play') return;
    portrait(dt);
    t -= dt; if (t > 0) return; t = 0.3;
    sample(); renderProd(); renderGroups(); renderLog(); renderVil(false);
  }
  return { init, tick, counterHTML };
})();
