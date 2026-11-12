// =====================================================================
//  GAME LIFECYCLE + MAIN LOOP
// =====================================================================
const Game = {
  mode: 'loading', paused: false, over: false, time: 0, speed: 1, reveal: false, visT: 0, winT: 0, menuSeed: 424242, chapter: null, busy: false,
  // opts: { seed, difficulty, theme, size, chapter }
  async start(opts) {
    if (this.busy) return; this.busy = true;
    opts = Object.assign({ seed: GameOpts.seed, difficulty: GameOpts.difficulty, theme: GameOpts.theme, size: GameOpts.size, chapter: null, pf: GameOpts.pf, ef: GameOpts.ef, boost: GameOpts.boost }, opts || this.lastOpts || {});
    const restore = opts.restore || null;
    opts = Object.assign({}, opts, { restore: null });
    if (!FACTIONS[opts.pf]) opts.pf = 'azure';
    if (!FACTIONS[opts.ef]) opts.ef = pick(Object.keys(FACTIONS).filter(k => k !== opts.pf));
    this.lastOpts = opts;
    Menus.close('menu'); Menus.close('pause'); Menus.close('endscreen'); Menus.close('story');
    showLoading('Preparing ' + (MAP_THEMES[opts.theme] || MAP_THEMES.vale).name + '…');
    await new Promise(r => setTimeout(r, 30));
    try {
      this.mode = 'play'; this.paused = false; this.over = false; this.time = 0; this.speed = GameOpts.speed; this.reveal = false;
      this.chapter = opts.chapter ? CAMPAIGN.find(c => c.id === opts.chapter) : null;
      await setupWorld(opts.seed, false, opts.theme, opts.size, !!restore, [opts.pf, opts.ef]);
      AIs.push(new AIPlayer(AIP, opts.difficulty));
      AutoWork.reset();
      const s = World.starts[HUMAN];
      Cam.x = s.x + 3; Cam.z = s.y + 3; Cam.tdist = Cam.dist = IS_MOBILE ? 22 : 26; Cam.tyaw = Cam.yaw = Math.PI / 4 + Math.PI; Cam.pitchOverride = null;
      computeVision(); fogCur.fill(0); updateFogTexture(10, false);
      if (restore) { SaveGame.apply(restore); View.ageUpBuildings(HUMAN); View.ageUpBuildings(AIP); updatePop(); computeVision(); }
      UI.reset(); Minimap.reset(); Story.begin(this.chapter, restore ? (restore.story || {}) : null); Tips.begin(); Extras.reset();
      if (restore) UI.notify('Saved game loaded', 'good', 'loaded');
      $('hud').classList.remove('hidden');
      Sound.init(); Sound.startMusic();
      if (!this.chapter && !restore) UI.notify('You lead the ' + players[HUMAN].name + '. Advance through the ages and defeat the ' + players[AIP].name + '!', 'good', 'intro');
      const tc = buildings.find(b => b.owner === HUMAN && b.type === 'towncenter');
      if (tc) Input.setSelection([tc]);
    } finally { hideLoading(); this.busy = false; }
  },
  async toMenu() {
    if (this.busy) return; this.busy = true;
    this.mode = 'menu'; this.paused = false; this.over = false; this.time = 0; this.speed = 1; this.reveal = true; this.chapter = null;
    $('hud').classList.add('hidden'); Menus.close('pause'); Menus.close('endscreen'); Menus.close('story'); UI.reset();
    try {
      await setupWorld(this.menuSeed, true, 'vale', 'small');
      buildDemoTown();
      AIs.push(new AIPlayer(HUMAN, 'standard'), new AIPlayer(AIP, 'standard'));
      const s = World.starts[HUMAN];
      Cam.x = s.x + 2; Cam.z = s.y + 2; Cam.tdist = Cam.dist = 22; Cam.tyaw = Cam.yaw = 0.3; Cam.pitchOverride = null;
      fogData.fill(255); fogTex.needsUpdate = true; fogCur.fill(1);
      Story.begin(null);
    } finally { this.busy = false; }
    Menus.refreshContinue(); Menus.open('menu');
  },
  togglePause(force) {
    if (this.mode !== 'play' || this.over) return;
    this.paused = force !== undefined ? force : !this.paused;
    if (this.paused) { Menus.open('pause'); Input.cancelPlace(); } else { Menus.close('pause'); while (UI.subMenuOpen) Menus.back(); }
  },
  end(win, reason) {
    if (this.over) return;
    this.over = true;
    Input.cancelPlace();
    Sound.play(win ? 'fanfare' : 'collapse');
    if (win && this.chapter) setCampaignProgress(this.chapter.camp, this.chapter.num + 1);
    SaveGame.clear(); Tips.hide();
    setTimeout(() => Menus.showEnd(win, reason), 1400);
  },
};
function showLoading(text) {
  let el = $('loading');
  if (!el) { el = document.createElement('div'); el.id = 'loading'; document.body.appendChild(el); }
  el.textContent = text; el.classList.remove('hidden');
}
function hideLoading() { const el = $('loading'); if (el) el.classList.add('hidden'); }

function resetWorld() {
  for (const b of buildings) View.removeBuildingMesh(b);
  for (const m of World.meshes) { scene.remove(m); if (m.userData.own && m.geometry) m.geometry.dispose(); }
  World.meshes = []; ResR.groups = {}; World.ambient = [];
  ents = new Map(); units = []; buildings = []; resources = []; projectiles = []; nextId = 1;
  PF.queue.length = 0; AIs.length = 0;
  PFX.clear(); View.resetFrame(); Input.reset();
}
// per-theme sky, fog and light
function applyThemeLook(TH) {
  const sky = new THREE.Color(TH.sky || SKY);
  scene.background = sky.clone(); renderer.setClearColor(sky);
  scene.fog.color.copy(lin(TH.sky || SKY));
  if (window.skyDome) {
    const g = skyDome.geometry, pa = g.attributes.position, cl = g.attributes.color, ct = new THREE.Color(TH.dark ? 0x46505e : 0x4f8fd6), ch = new THREE.Color(TH.sky || SKY), cw = new THREE.Color(TH.dark ? 0x8a8070 : 0xf4e6c8), c = new THREE.Color();
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 320; c.copy(ch).lerp(ct, clamp(y * 1.6, 0, 1)); if (y < 0.12 && y > -0.2) c.lerp(cw, (0.12 - Math.abs(y - 0.02)) * 1.6); c.convertSRGBToLinear(); cl.setXYZ(i, c.r, c.g, c.b); }
    cl.needsUpdate = true;
  }
  sun.color.set(TH.sun || 0xffe9c4); sun.intensity = TH.dark ? 0.95 : 1.25;
  hemi.intensity = TH.dark ? 0.5 : 0.62;
}
async function setupWorld(seed, humanAI, themeKey = 'vale', sizeKey = 'normal', bare = false, factions = ['azure', 'crimson']) {
  resetWorld();
  const TH = MAP_THEMES[themeKey] || MAP_THEMES.vale;
  if (TH.pack) await loadPack(TH.pack);
  N = (MAP_SIZES[sizeKey] || MAP_SIZES.normal).n;
  allocPathfinder(); allocHash(); makeFogTexture(); fogCur = new Float32Array(N * N);
  players = [makePlayer(0, !!humanAI), makePlayer(1, true), makePlayer(2, false)];
  applyFaction(players[0], factions[0]); applyFaction(players[1], factions[1]);
  Boost.set((Game.lastOpts && Game.lastOpts.boost) || 1, true);
  const { resList, deer } = generateMap(seed, themeKey);
  buildResourceMeshes(resList);
  placeProps();
  buildTerrain();
  buildDecorations();
  applyThemeLook(TH);
  if (!bare) for (const pi of [HUMAN, AIP]) {
    const s = World.starts[pi];
    createBuilding('towncenter', pi, s.x - 2, s.y - 2, true);
    const dir = pi === 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) spawnUnit('villager', pi, s.x + dir * (3 + k * 0.8), s.y + dir * (3.2 - k * 0.6));
    spawnUnit('scout', pi, s.x + dir * 1.5, s.y + dir * 3.5);
  }
  // flood-fill reachable ground from the starts so animals never spawn inside sealed tree pockets
  const reach = new Uint8Array(N * N), q = []; for (const st of World.starts) { const nf = nearestFree(st.x + 3, st.y + 3, GAIA, 6); if (nf) { const i = idx(nf.x | 0, nf.z | 0); reach[i] = 1; q.push(i); } }
  while (q.length) { const c = q.pop(), cx = c % N, cy = (c / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (!inb(nx, ny)) continue; const ni = idx(nx, ny); if (reach[ni] || World.pass[ni]) continue; reach[ni] = 1; q.push(ni); } }
  for (let [x, z, type] of bare ? [] : deer) {
    type = type || 'deer';
    if (!(CHAR_FOR[type] || []).some(hasModel) && type !== 'deer') type = 'deer'; // no model loaded -> fall back to built-in deer
    if (!reach[idx(x | 0, z | 0)]) { let best = null, bd = 1e9; for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const tx = (x | 0) + dx, ty = (z | 0) + dy; if (inb(tx, ty) && reach[idx(tx, ty)] && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = [tx + 0.5, ty + 0.5]; } } if (!best) continue; [x, z] = best; }
    const d = spawnUnit(type, GAIA, x, z); d.home = { x: d.x, z: d.z };
  }
  Game.visT = 0; Game.winT = 1;
  computeVision();
  Minimap.reset();
  Atmos.reset();
}
function buildDemoTown() {
  const p = players[HUMAN]; p.age = 1;
  const ai = new AIPlayer(HUMAN, 'standard');
  const s = World.starts[HUMAN];
  const put = (t, r0, r1) => { const sp = ai.findSpot(t, s.x + 3, s.y + 3, r0, r1); if (sp) createBuilding(t, HUMAN, sp.tx, sp.ty, true); };
  for (let i = 0; i < 4; i++) put('house', 4, 9);
  put('mill', 4, 8); for (let i = 0; i < 3; i++) put('farm', 4, 8);
  put('barracks', 6, 11); put('blacksmith', 6, 11); put('lumbercamp', 7, 12); put('tower', 6, 10); put('range', 7, 12);
  View.ageUpBuildings(HUMAN);
  for (let i = 0; i < 9; i++) spawnUnit('villager', HUMAN, s.x + 3 + rand(-1, 1), s.y + 3 + rand(-1, 1));
  for (let i = 0; i < 5; i++) spawnUnit(i % 2 ? 'spearman' : 'archer', HUMAN, s.x + 6 + rand(-1, 1), s.y + 6 + rand(-1, 1));
  p.res.food += 300; p.res.wood += 300;
}

function updatePop() {
  for (let i = 0; i < 2; i++) { players[i].pop = 0; players[i].cap = 0; }
  for (const u of units) if (!u.dead && u.owner <= 1) players[u.owner].pop++;
  for (const b of buildings) {
    if (b.dead || b.owner > 1) continue;
    if (b.built) players[b.owner].cap += (BUILDINGS[b.type].pop || 0) + (BUILDINGS[b.type].pop ? 2 * ((b.level || 1) - 1) : 0);
    const it = b.queue[0]; if (it && it.kind === 'unit' && it.started) players[b.owner].pop++;
  }
  for (let i = 0; i < 2; i++) players[i].popCap = Math.min(POP_MAX, players[i].cap);
}
function simStep(dt) {
  Game.time += dt;
  updatePop();
  rebuildHash();
  for (const b of buildings) { b.builders = b._bc; b._bc = 0; }
  processPathQueue(3);
  for (let i = 0; i < units.length; i++) updateUnit(units[i], dt);
  separation(dt);
  for (let i = 0; i < buildings.length; i++) updateBuilding(buildings[i], dt);
  updateProjectiles(dt);
  // cleanup
  for (let i = units.length - 1; i >= 0; i--) { const u = units[i]; if (u.dead && u.dieT > 2.6) { units.splice(i, 1); ents.delete(u.id); } }
  for (let i = buildings.length - 1; i >= 0; i--) { const b = buildings[i]; if (b.dead && b.dieT > 2.8) { View.removeBuildingMesh(b); buildings.splice(i, 1); ents.delete(b.id); } }
  for (let i = resources.length - 1; i >= 0; i--) if (resources[i].dead) resources.splice(i, 1);
  Game.visT -= dt;
  if (Game.visT <= 0) { Game.visT = 0.25; computeVision(); }
  for (const ai of AIs) ai.update(dt);
  AutoWork.update(dt);
  Story.tick(dt);
  Game.winT -= dt;
  if (Game.winT <= 0) { Game.winT = 1; checkWin(); }
}
function checkWin() {
  const alive = pi => units.some(u => u.owner === pi && !u.dead) || buildings.some(b => b.owner === pi && !b.dead && b.type !== 'wall' && b.type !== 'gate');
  for (const b of buildings) if (b.type === 'wonder' && b.built && !b.dead && b.wonderT !== undefined && b.wonderT <= 0) {
    if (Game.mode === 'play') Game.end(b.owner === HUMAN, b.owner === HUMAN ? 'Your Wonder stood for five minutes. Your realm is eternal.' : 'The enemy Wonder stood for five minutes.');
    else Game.toMenu();
    return;
  }
  const a0 = alive(HUMAN), a1 = alive(AIP);
  // once the enemy has lost its Town Center, its last buildings are revealed so the war can be finished
  if (Game.mode === 'play' && a1 && !buildings.some(b => b.owner === AIP && b.type === 'towncenter' && !b.dead)) {
    let n = 0; for (const b of buildings) if (b.owner === AIP && !b.dead && !b.seenBy0) { b.seenBy0 = true; n++; for (let y = b.ty - 1; y <= b.ty + b.size; y++) for (let x = b.tx - 1; x <= b.tx + b.size; x++) if (inb(x, y)) players[HUMAN].exp[idx(x, y)] = 1; }
    if (n) { UI.notify('The ' + players[AIP].name + ' has fallen back — its last strongholds are revealed on the map!', 'good', 'remnants'); Minimap.dirty = true; }
  }
  for (const i of [0, 1]) players[i].alive = i === 0 ? a0 : a1;
  // an AI realm with no Town Center and no army left gives up instead of dragging the game out
  for (const me of [AIP, HUMAN]) {
    const p = players[me]; if (!p.isAI || Game.mode !== 'play') continue;
    const hasTC = buildings.some(b => b.owner === me && b.type === 'towncenter' && !b.dead);
    const mil = units.filter(u => u.owner === me && !u.dead && isMil(u)).length;
    p.doomT = (!hasTC && mil < 3) ? (p.doomT || 0) + 1 : 0;
    if (p.doomT > 45) { if (me === AIP) { players[AIP].alive = false; Game.end(true, 'With no Town Center and no army left, the ' + players[AIP].name + ' surrenders.'); } else Game.end(false, 'Your realm has fallen.'); return; }
  }
  if (Game.mode === 'play') {
    if (!a0) Game.end(false, 'All your units and buildings have been destroyed.');
    else if (!a1) Game.end(true, 'The ' + players[AIP].name + ' has been wiped from the land.');
  } else if (Game.mode === 'menu' && (!a0 || !a1 || Game.time > 1500)) Game.toMenu();
}

// ambient life: drifting motes and falling leaves around the camera focus
function ambient(dt) {
  const n = Settings.quality === 'low' ? 0.5 : 1.5;
  if (Math.random() < dt * 8 * n) PFX.mote(Cam.x + rand(-14, 14), heightAt(Cam.x, Cam.z) + rand(0.3, 2.5), Cam.z + rand(-14, 14));
  if (Math.random() < dt * 4 * n && resources.length) {
    const r = resources[(Math.random() * resources.length) | 0];
    if (r.rtype === 'tree' && Math.abs(r.x - Cam.x) < 20 && Math.abs(r.z - Cam.z) < 20) PFX.leaf(r.x, heightAt(r.x, r.z) + 1.1, r.z);
  }
}

let lastT = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 1) { Game.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  U.uTime.value += dt;
  try {
    if (Game.mode === 'play' || Game.mode === 'menu') {
      if (!Game.paused && !Game.over) {
        let rem = dt * (Game.mode === 'menu' ? 1 : Game.speed);
        while (rem > 1e-4) { const st = Math.min(rem, 0.05); simStep(st); rem -= st; }
      }
      Input.update(dt);
      if (Game.mode === 'menu') { Cam.tyaw += dt * 0.06; Cam.yaw = Cam.tyaw; const s = World.starts[HUMAN]; Cam.x = lerp(Cam.x, s.x + 3, dt); Cam.z = lerp(Cam.z, s.y + 3, dt); }
      applyCamera(dt);
      Atmos.update(dt, Game.paused || Game.over ? 0 : dt * (Game.mode === 'menu' ? 1 : Game.speed));
      if (Game.mode === 'play') updateFogTexture(dt, Game.reveal);
      View.sync(dt);
      updateAmbient(U.uTime.value);
      if (!Game.paused) { PFX.update(dt * (Game.mode === 'play' ? Math.min(Game.speed, 1.5) : 1)); ambient(dt); }
      if (Game.mode === 'play') { UI.update(dt); UI.frame(dt); Minimap.draw(dt); Extras.tick(dt); Tips.tick(dt); UI2.tick(dt); }
    }
  } catch (err) { console.error(err); }
  Post.render(dt);
}

async function boot() {
  initRenderer();
  PFX.init();
  Atmos.init();
  Post.init();
  if (!PACKS_LOADED.has('core')) await loadPack('core');
  View.init();
  RESGEO = buildResourceModels();
  View.renderIcons();
  Input.init();
  UI.init();
  UI2.init();
  requestAnimationFrame(frame);
  await Game.toMenu();
  hideLoading();
  // debug / test hooks
  window.IV = {
    Game, get players() { return players; }, get units() { return units; }, get buildings() { return buildings; }, AIs,
    step(sec, dt = 0.1) { const t0 = performance.now(); for (let t = 0; t < sec && !Game.over; t += dt) simStep(dt); return Math.round(performance.now() - t0) + 'ms'; },
    autoplay(diff = 'standard') { players[HUMAN].isAI = true; AIs.push(new AIPlayer(HUMAN, diff)); },
    reveal(v = true) { Game.reveal = v; },
    summary() {
      return [0, 1].map(i => { const p = players[i]; return { age: p.age, pop: p.pop + '/' + p.popCap, res: Object.fromEntries(RESN.map(r => [r, Math.floor(p.res[r])])), vils: units.filter(u => u.owner === i && u.type === 'villager' && !u.dead).length, army: units.filter(u => u.owner === i && isMil(u) && !u.dead).length, blds: buildings.filter(b => b.owner === i && !b.dead).map(b => b.type).join(','), stats: p.stats }; });
    },
  };
}
window.addEventListener('load', () => {
  if (typeof THREE === 'undefined') { $('loading').textContent = 'Could not load three.js — check your connection.'; return; }
  boot().catch(e => { console.error(e); const l = $('loading'); if (l) l.textContent = 'Error starting game: ' + e.message; });
});
