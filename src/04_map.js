// =====================================================================
//  MAP — procedural, point-symmetric terrain, resources & grid
// =====================================================================
const T_GRASS = 0, T_DIRT = 1, T_SAND = 2, T_WATER = 3, T_HILL = 4;
const WATER_Y = -0.28;
const World = {
  ter: null, th: null, vh: null, pass: null, occ: null, gate: null, seed: 0,
  starts: [], meshes: [], resMeshes: {}, terrainColors: null,
};
// pass: 0 free, 1 blocked, 2 gate (free for the gate owner only)
function tileFree(x, y, owner) {
  if (x < 0 || y < 0 || x >= N || y >= N) return false;
  const p = World.pass[y * N + x];
  return p === 0 || (p === 2 && World.gate[y * N + x] === owner);
}
function posFree(x, z, owner) { return tileFree(Math.floor(x), Math.floor(z), owner); }
function heightAt(x, z) {
  x = clamp(x, 0, N - 0.001); z = clamp(z, 0, N - 0.001);
  const ix = x | 0, iz = z | 0, fx = x - ix, fz = z - iz, W1 = N + 1, vh = World.vh;
  const a = vh[iz * W1 + ix], b = vh[iz * W1 + ix + 1], c = vh[(iz + 1) * W1 + ix], d = vh[(iz + 1) * W1 + ix + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

function generateMap(seed, themeKey) {
  World.seed = seed; World.removed = [];
  const TH = World.theme = MAP_THEMES[themeKey] || MAP_THEMES.vale; World.themeKey = themeKey;
  const pickModel = (list, r) => { const ok = list.filter(hasModel); return ok.length ? ok[Math.floor(r * ok.length) % ok.length] : null; };
  const rng = mulberry32(seed * 7919 + 13);
  const nH = makeNoise(rng), nW = makeNoise(rng), nF = makeNoise(rng), nD = makeNoise(rng);
  const ter = World.ter = new Uint8Array(N * N);
  const th = World.th = new Float32Array(N * N);
  World.pass = new Uint8Array(N * N); World.occ = new Int32Array(N * N); World.gate = new Int8Array(N * N).fill(-1);
  const so = N >= 150 ? 22 : N >= 120 ? 20 : 18;
  const S0 = { x: so, y: so }, S1 = { x: N - so, y: N - so };
  World.starts = [S0, S1];
  const sym = (f, x, y, sc, oct) => (f(x * sc, y * sc, oct) + f((N - 1 - x) * sc, (N - 1 - y) * sc, oct)) * 0.5;
  const H = new Float32Array(N * N), Wt = new Float32Array(N * N), F = new Float32Array(N * N), D = new Float32Array(N * N), dS = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    H[i] = sym(nH, x, y, 1 / 22, 4); Wt[i] = sym(nW, x, y, 1 / 18, 3); F[i] = sym(nF, x, y, 1 / 9, 3); D[i] = sym(nD, x, y, 1 / 11, 3);
    if (TH.coastal) { const dc = Math.min(Math.hypot(x, N - y), Math.hypot(N - x, y)) / N; if (dc < 0.42) Wt[i] -= (0.42 - dc) * 1.4; }
    dS[i] = Math.min(Math.hypot(x + 0.5 - S0.x, y + 0.5 - S0.y), Math.hypot(x + 0.5 - S1.x, y + 0.5 - S1.y));
  }
  const pct = (arr, p) => { const s = Array.from(arr).sort((a, b) => a - b); return s[Math.floor(s.length * p)]; };
  const hHill = pct(H, 1 - TH.hills), hMid = pct(H, 0.5), wLake = pct(Wt, TH.water), wSand = pct(Wt, TH.water + TH.sand), fFor = pct(F, 1 - TH.forest), dDirt = pct(D, 1 - TH.dirt);
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = (i / N) | 0;
    let h = (H[i] - hMid) * 2.2;
    let t = T_GRASS;
    if (H[i] > hHill) { h += (H[i] - hHill) * TH.hillAmp; t = T_HILL; }
    if (D[i] > dDirt) t = t === T_HILL ? T_HILL : T_DIRT;
    const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    if (Wt[i] < wLake && dS[i] > 20 && edge > 2) { t = T_WATER; h = -0.95; }
    else if (Wt[i] < wSand && dS[i] > 17) { t = T_SAND; h = Math.min(h, 0.05) - 0.05; }
    if (dS[i] < 14) { const k = clamp((dS[i] - 9) / 5, 0, 1); h = lerp(0.05, h, k); if (t === T_HILL || t === T_WATER || t === T_SAND) t = k > 0.6 ? t : T_GRASS; if (t === T_WATER) { t = T_SAND; h = -0.05; } }
    if (dS[i] < 4.5) t = T_DIRT;
    if (t !== T_WATER) h = Math.max(h, 0.04);   // land always sits above the water table
    ter[i] = t; th[i] = h;
  }
  // vertex heights
  computeVertexHeights();
  // ---------- trees (symmetric) ----------
  const resList = [];
  const addRes = (rtype, tx, ty, size, extra) => { resList.push(Object.assign({ rtype, tx, ty, size }, extra || {})); };
  const treeOk = (x, y) => ter[idx(x, y)] !== T_WATER && (ter[idx(x, y)] !== T_SAND || !!TH.beachTrees);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (!treeOk(x, y)) continue;
    const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    const mi = Math.min(i, idx(N - 1 - x, N - 1 - y));
    const r = hash2(mi % N, (mi / N) | 0, seed);
    let tree = false;
    if (dS[i] > 9.5 && F[i] > fFor && r < 0.82) tree = true;
    if (edge < 3 && r < 0.9) tree = true;
    if (dS[i] > 9.5 && r < 0.006) tree = true;
    let list = edge < 3 ? TH.edgeTrees : TH.trees;
    if (TH.beachTrees) { let beach = false; for (let dy = -2; dy <= 2 && !beach; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy) && ter[idx(x + dx, y + dy)] === T_SAND) { beach = true; break; } if (beach) { list = TH.beachTrees; if (dS[i] > 12 && r < 0.12) tree = true; } }
    if (tree) World.pass[i] = 1, addRes('tree', x, y, 1, { variant: pickModel(list, hash2(mi, 7, seed)) || (hash2(mi, 7, seed) < 0.5 ? 'pine' : 'oak') });
  }
  // ---------- mirrored base resources ----------
  const taken = new Uint8Array(N * N);
  const clearTrees = (cx, cy, rad) => {
    for (let k = resList.length - 1; k >= 0; k--) { const r = resList[k]; if (r.rtype === 'tree' && Math.hypot(r.tx + 0.5 - cx, r.ty + 0.5 - cy) < rad) { World.pass[idx(r.tx, r.ty)] = 0; resList.splice(k, 1); } }
  };
  const areaOk = (tx, ty, s, m = 1) => {
    for (let y = ty - m; y < ty + s + m; y++) for (let x = tx - m; x < tx + s + m; x++) {
      if (!inb(x, y) || x < 2 || y < 2 || x > N - 3 || y > N - 3) return false;
      if (taken[idx(x, y)] || ter[idx(x, y)] === T_WATER) return false;
      // keep the start TC areas clear
      if (Math.hypot(x + 0.5 - S0.x, y + 0.5 - S0.y) < 5.5 || Math.hypot(x + 0.5 - S1.x, y + 0.5 - S1.y) < 5.5) return false;
    }
    // must also be fine at the mirrored location
    const mx = N - tx - s, my = N - ty - s;
    if (Math.abs(mx - tx) < s + 2 && Math.abs(my - ty) < s + 2) return false;
    for (let y = my - m; y < my + s + m; y++) for (let x = mx - m; x < mx + s + m; x++) { if (!inb(x, y) || taken[idx(x, y)] || ter[idx(x, y)] === T_WATER) return false; }
    return true;
  };
  const mark = (tx, ty, s) => { for (let y = ty; y < ty + s; y++) for (let x = tx; x < tx + s; x++) taken[idx(x, y)] = 1; };
  const placeMir = (rtype, tx, ty, s, extra) => {
    clearTrees(tx + s / 2, ty + s / 2, s * 0.9 + 0.6); clearTrees(N - tx - s / 2, N - ty - s / 2, s * 0.9 + 0.6);
    addRes(rtype, tx, ty, s, extra); mark(tx, ty, s);
    const mx = N - tx - s, my = N - ty - s; addRes(rtype, mx, my, s, extra); mark(mx, my, s);
  };
  const tryAround = (cx, cy, dmin, dmax, s, tries = 80) => {
    for (let k = 0; k < tries; k++) {
      const a = rng() * Math.PI * 2, d = dmin + rng() * (dmax - dmin);
      const tx = Math.round(cx + Math.cos(a) * d - s / 2), ty = Math.round(cy + Math.sin(a) * d - s / 2);
      if (areaOk(tx, ty, s, 1)) return [tx, ty];
    }
    return null;
  };
  clearTrees(S0.x, S0.y, 9); clearTrees(S1.x, S1.y, 9);
  // forest patch near each base
  {
    const a = rng() * Math.PI * 2; const fx = S0.x + Math.cos(a) * 13, fy = S0.y + Math.sin(a) * 13;
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const tx = Math.round(fx + x), ty = Math.round(fy + y);
      if (!inb(tx, ty) || x * x + y * y > 18 + rng() * 8) continue;
      for (const [px, py] of [[tx, ty], [N - 1 - tx, N - 1 - ty]]) {
        if (!inb(px, py) || taken[idx(px, py)] || World.pass[idx(px, py)] || ter[idx(px, py)] === T_WATER || Math.hypot(px + 0.5 - S0.x, py + 0.5 - S0.y) < 9 || Math.hypot(px + 0.5 - S1.x, py + 0.5 - S1.y) < 9) continue;
        World.pass[idx(px, py)] = 1; addRes('tree', px, py, 1, { variant: pickModel(TH.trees, rng()) || 'pine' });
      }
    }
  }
  const gm = () => ({ model: pickModel(TH.gold, rng()) }), sm = () => ({ model: pickModel(TH.stone, rng()) });
  const base = [
    ['gold', 2, 8, 11, Object.assign({ amount: 800 }, gm())], ['gold', 2, 11, 15, Object.assign({ amount: 800 }, gm())], ['stone', 2, 9, 13, Object.assign({ amount: 700 }, sm())],
  ];
  for (const [rt, s, d0, d1, ex] of base) { const p = tryAround(S0.x, S0.y, d0, d1, s); if (p) placeMir(rt, p[0], p[1], s, ex); }
  // berry cluster
  for (let k = 0; k < 60; k++) {
    const p = tryAround(S0.x, S0.y, 7.5, 9.5, 3);
    if (!p) continue;
    const cells = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
    for (const [dx, dy] of cells) placeMir('berry', p[0] + dx, p[1] + dy, 1, { amount: 125, model: hasModel('berries') ? 'berries' : undefined });
    break;
  }
  // deer
  const deer = [];
  const addAnimal = (type, tx, ty) => { deer.push([tx + 0.5, ty + 0.5, type]); deer.push([N - tx - 0.5, N - ty - 0.5, type]); };
  const animalOk = t => (CHAR_FOR[t] || []).some(hasModel) || t === 'deer';
  // huntable game near each base (mirrored for fairness)
  for (let k = 0; k < 5; k++) { const type = TH.hunt[k % TH.hunt.length]; if (!animalOk(type)) continue; const p = tryAround(S0.x, S0.y, 10, 16, 1); if (p) { mark(p[0], p[1], 1); addAnimal(type, p[0], p[1]); } }
  // one big beast a little further out
  { const type = TH.big[(rng() * TH.big.length) | 0]; const p = tryAround(S0.x, S0.y, 15, 20, 1); if (p && animalOk(type)) { mark(p[0], p[1], 1); addAnimal(type, p[0], p[1]); } }
  // village livestock grazing next to the town centre
  for (let k = 0; k < 5; k++) { const type = TH.livestock[k % TH.livestock.length]; if (!animalOk(type)) continue; const p = tryAround(S0.x, S0.y, 4.5, 7, 1, 40); if (p) addAnimal(type, p[0], p[1]); }
  // contested resources across the map (in P0 half, mirrored)
  const halfOk = (tx, ty) => tx + ty < N - 14 && Math.hypot(tx - S0.x, ty - S0.y) > 26;
  const areaK = (N * N) / (120 * 120);
  const extra = [];
  for (let k = 0; k < Math.round(2 * areaK); k++) extra.push(['gold', 2, Object.assign({ amount: 1000 }, gm())], ['stone', 2, Object.assign({ amount: 900 }, sm())]);
  for (const [rt, s, ex] of extra) {
    for (let k = 0; k < 200; k++) {
      const tx = 4 + ((rng() * (N - 8)) | 0), ty = 4 + ((rng() * (N - 8)) | 0);
      if (!halfOk(tx, ty) || !areaOk(tx, ty, s, 1)) continue;
      placeMir(rt, tx, ty, s, ex); break;
    }
  }
  for (let k = 0; k < Math.round(2 * areaK); k++) for (let t = 0; t < 200; t++) {
    const tx = 4 + ((rng() * (N - 8)) | 0), ty = 4 + ((rng() * (N - 8)) | 0);
    if (!halfOk(tx, ty) || !areaOk(tx, ty, 3, 1)) continue;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]]) placeMir('berry', tx + dx, ty + dy, 1, { amount: 125, model: hasModel('berries') ? 'berries' : undefined }); break;
  }
  const wildPool = [...TH.hunt, ...TH.hunt, ...TH.big].filter(animalOk);
  for (let k = 0; k < Math.round(9 * areaK); k++) for (let t = 0; t < 100; t++) {
    const tx = 4 + ((rng() * (N - 8)) | 0), ty = 4 + ((rng() * (N - 8)) | 0);
    if (!halfOk(tx, ty) || !areaOk(tx, ty, 1, 1) || !wildPool.length) continue;
    const type = wildPool[(rng() * wildPool.length) | 0];
    mark(tx, ty, 1); addAnimal(type, tx, ty);
    // herds and packs
    if (['deer', 'antelope', 'parasaurolophus', 'sheep', 'goat', 'crab', 'frog', 'rabbit'].includes(type)) for (let h = 0; h < 2; h++) { const hx = tx + randi(-2, 2), hy = ty + randi(-2, 2); if (areaOk(hx, hy, 1, 0)) addAnimal(type, hx, hy); }
    break;
  }
  // ---------- hostile camps guarding treasure (mirrored) ----------
  const CAMPS = { wolves: { guards: ['wolf', 'wolf', 'wolf'], boss: 'bear', chest: 'chest', amount: 350 },
    pirates: { guards: ['pirate', 'pirate', 'pirate'], boss: 'pirate_captain', chest: 'treasure', amount: 500 },
    raptors: { guards: ['raptor', 'raptor', 'raptor'], boss: 'trex', chest: 'crystal_1', amount: 700 },
    graveyard: { guards: ['skeleton', 'skeleton', 'skeleton'], boss: 'skeleton_warrior', chest: 'chest_closed', amount: 450 } };
  const camps = [];
  const cdef = CAMPS[TH.camp];
  if (cdef) {
    const nCamps = N >= 190 ? 4 : N >= 150 ? 3 : N >= 120 ? 2 : 1;
    for (let c = 0; c < nCamps; c++) for (let t = 0; t < 300; t++) {
      const tx = 6 + ((rng() * (N - 12)) | 0), ty = 6 + ((rng() * (N - 12)) | 0);
      if (tx + ty > N - 12 || Math.hypot(tx - S0.x, ty - S0.y) < 26 || Math.hypot(tx - S1.x, ty - S1.y) < 30) continue;
      if (!areaOk(tx - 2, ty - 2, 5, 1)) continue;
      if (camps.some(k => Math.hypot(k.tx - tx, k.ty - ty) < 18)) continue;
      clearTrees(tx + 0.5, ty + 0.5, 4); clearTrees(N - tx - 0.5, N - ty - 0.5, 4);
      const chest = hasModel(cdef.chest) ? cdef.chest : 'chest';
      placeMir('treasure', tx, ty, 1, { amount: cdef.amount, model: chest });
      const guards = c === 0 && (CHAR_FOR[cdef.boss] || []).some(hasModel) ? [cdef.boss, ...cdef.guards.slice(0, 2)] : cdef.guards;
      for (const [mx, my] of [[tx, ty], [N - 1 - tx, N - 1 - ty]]) { camps.push({ tx: mx, ty: my, kind: TH.camp }); for (let y = my - 2; y <= my + 2; y++) for (let x = mx - 2; x <= mx + 2; x++) if (inb(x, y)) taken[idx(x, y)] = 1; }
      guards.forEach((g, gi) => { const a = gi * 2.1 + 0.5; const gx = Math.round(tx + Math.cos(a) * 1.8), gy = Math.round(ty + Math.sin(a) * 1.8); if ((CHAR_FOR[g] || []).some(hasModel)) addAnimal(g, gx, gy); });
      break;
    }
  }
  World.camps = camps;
  // block resource tiles
  for (const r of resList) for (let y = r.ty; y < r.ty + r.size; y++) for (let x = r.tx; x < r.tx + r.size; x++) World.pass[idx(x, y)] = 1;
  for (let i = 0; i < N * N; i++) if (ter[i] === T_WATER) World.pass[i] = 1;
  // ---------- connectivity: carve a corridor if bases are not linked ----------
  if (!connected(S0, S1)) {
    const steps = 200;
    for (let s = 0; s <= steps; s++) {
      const cx = lerp(S0.x, S1.x, s / steps), cy = lerp(S0.y, S1.y, s / steps) + Math.sin(s / steps * Math.PI) * 6;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const x = Math.floor(cx + ox), y = Math.floor(cy + oy); if (!inb(x, y)) continue;
        for (const [px, py] of [[x, y], [N - 1 - x, N - 1 - y]]) {
          const i = idx(px, py);
          if (ter[i] === T_WATER) { ter[i] = T_SAND; th[i] = 0.04; }
          for (let k = resList.length - 1; k >= 0; k--) { const r = resList[k]; if (r.rtype === 'tree' && r.tx === px && r.ty === py) resList.splice(k, 1); }
          World.pass[i] = 0;
        }
      }
    }
    for (const r of resList) for (let y = r.ty; y < r.ty + r.size; y++) for (let x = r.tx; x < r.tx + r.size; x++) World.pass[idx(x, y)] = 1;
    computeVertexHeights();
  }
  return { resList, deer };
}
function computeVertexHeights() {
  const W1 = N + 1, vh = World.vh = new Float32Array(W1 * W1), th = World.th;
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
    let s = 0, c = 0, wet = false;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const tx = x + dx, ty = y + dy; if (inb(tx, ty)) { s += th[idx(tx, ty)]; c++; if (World.ter[idx(tx, ty)] === T_WATER) wet = true; } }
    vh[y * W1 + x] = (c ? s / c : 0) - (wet ? 0.15 : 0);
  }
}
function connected(a, b) {
  const seen = new Uint8Array(N * N), q = new Int32Array(N * N); let h = 0, t = 0;
  const sx = Math.floor(a.x) + 3, sy = Math.floor(a.y) + 3; q[t++] = idx(sx, sy); seen[idx(sx, sy)] = 1;
  const gx = Math.floor(b.x) - 3, gy = Math.floor(b.y) - 3;
  while (h < t) {
    const c = q[h++]; const x = c % N, y = (c / N) | 0;
    if (Math.abs(x - gx) <= 2 && Math.abs(y - gy) <= 2) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const ni = idx(nx, ny); if (seen[ni] || World.pass[ni]) continue; seen[ni] = 1; q[t++] = ni; }
  }
  return false;
}

// ------------------------------------------------------------------
//  TERRAIN + WATER MESHES
// ------------------------------------------------------------------
const TER_COL = [new THREE.Color(0x66a03c), new THREE.Color(0x9c7a4c), new THREE.Color(0xdccb92), new THREE.Color(0x3d6a6e), new THREE.Color(0x7a9c48)];
function buildTerrain() {
  const W1 = N + 1, vh = World.vh, ter = World.ter;
  const pos = new Float32Array(W1 * W1 * 3), col = new Float32Array(W1 * W1 * 3), uv = new Float32Array(W1 * W1 * 2);
  const c = new THREE.Color(), tmp = new THREE.Color();
  const tn = makeNoise(mulberry32(World.seed + 5));
  const PL = World.theme.palette;
  const TCOL = [new THREE.Color(PL.grass), new THREE.Color(PL.dirt), new THREE.Color(PL.sand), new THREE.Color(World.theme.dark ? 0x2f4a44 : 0x3d6a6e), new THREE.Color(PL.grass).lerp(new THREE.Color(PL.rock), 0.2)];
  World.terrainColors = new Uint8Array(N * N * 3);
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
    const v = y * W1 + x;
    pos[v * 3] = x; pos[v * 3 + 1] = vh[v]; pos[v * 3 + 2] = y;
    uv[v * 2] = x / 3; uv[v * 2 + 1] = y / 3;
    c.setRGB(0, 0, 0); let n = 0;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const tx = x + dx, ty = y + dy; if (inb(tx, ty)) { c.add(TCOL[ter[idx(tx, ty)]]); n++; } }
    c.multiplyScalar(1 / n);
    const h = vh[v];
    // meadow variation + darker forest floor
    const grassy = c.g > c.r * 1.2 && c.g > c.b * 1.4;
    if (grassy) {
      const mv = tn(x / 13, y / 13), mv2 = tn(x / 4 + 40, y / 4);
      tmp.set(PL.meadow); c.lerp(tmp, clamp((mv - 0.45) * 1.6, 0, 0.55));
      tmp.set(PL.deep); c.lerp(tmp, clamp((0.5 - mv) * 1.4, 0, 0.45));
      c.offsetHSL(0, 0, (mv2 - 0.5) * 0.06);
      let tr = 0; for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) { const tx = x + dx, ty = y + dy; if (inb(tx, ty)) { const e = ents.get(World.occ[idx(tx, ty)]); if (e && e.rtype === 'tree') tr++; } }
      if (tr) { tmp.set(PL.forest); c.lerp(tmp, Math.min(0.55, tr * 0.06)); }
    }
    const nz = hash2(x, y, 99) * 0.07 - 0.035;
    c.offsetHSL(0, 0, nz);
    if (h > 0.9) { tmp.set(PL.rock); c.lerp(tmp, clamp((h - 0.9) / 2.2, 0, 0.55)); }
    // slope darkening
    const hx = vh[y * W1 + Math.min(x + 1, N)] - vh[y * W1 + Math.max(x - 1, 0)], hz = vh[Math.min(y + 1, N) * W1 + x] - vh[Math.max(y - 1, 0) * W1 + x];
    const slope = Math.sqrt(hx * hx + hz * hz);
    if (slope > 0.5) { tmp.set(0x7a7462); c.lerp(tmp, clamp((slope - 0.5) * 0.4, 0, 0.5)); }
    { const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11, k = 0.2; c.r = lerp(c.r, lum * 1.04, k) * 0.94; c.g = lerp(c.g, lum, k) * 0.92; c.b = lerp(c.b, lum * 0.9, k) * 0.94; } // earthy, less neon ground
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = y * W1 + x, i = idx(x, y) * 3;
    World.terrainColors[i] = col[v * 3] * 255; World.terrainColors[i + 1] = col[v * 3 + 1] * 255; World.terrainColors[i + 2] = col[v * 3 + 2] * 255;
    if (ter[idx(x, y)] === T_WATER) { World.terrainColors[i] = 60; World.terrainColors[i + 1] = 120; World.terrainColors[i + 2] = 170; }
  }
  for (let k = 0; k < col.length; k++) { const v = col[k]; col[k] = v < 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4); }
  const index = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = y * W1 + x, b = a + 1, cc = a + W1, d = cc + 1; index.push(a, cc, b, b, cc, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index); g.computeVertexNormals();
  const m = new THREE.Mesh(g, MAT.terrain); m.receiveShadow = true; m.userData.own = true;
  scene.add(m); World.meshes.push(m);
  // skirt / ground beyond the map
  const sk = new THREE.Mesh(new THREE.PlaneGeometry(N * 4, N * 4), new THREE.MeshBasicMaterial({ color: 0x0c120a }));
  sk.rotation.x = -Math.PI / 2; sk.position.set(N / 2, -1.2, N / 2); sk.userData.own = true; scene.add(sk); World.meshes.push(sk);
  // water
  // water surface is built only over water tiles (+ a one-tile shore ring) and carries a
  // per-vertex "distance from shore" value used for depth colour, transparency and foam
  const dist = new Float32Array(N * N).fill(99), q = [];
  for (let i = 0; i < N * N; i++) if (ter[i] !== T_WATER) { dist[i] = 0; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (ter[idx(x, y)] !== T_WATER) continue; let edge = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inb(x + dx, y + dy) || ter[idx(x + dx, y + dy)] !== T_WATER) edge = inb(x + dx, y + dy) || edge; if (edge) { dist[idx(x, y)] = 1; q.push(idx(x, y)); } }
  for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % N, cy = (c / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (!inb(nx, ny)) continue; const ni = idx(nx, ny); if (ter[ni] === T_WATER && dist[ni] > dist[c] + 1) { dist[ni] = dist[c] + 1; q.push(ni); } } }
  const vmap = new Map(), wp = [], ws = [], wi = [];
  const vert = (x, y) => {
    const key = y * W1 + x; let v = vmap.get(key); if (v !== undefined) return v;
    let sum = 0, n = 0; for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const tx = x + dx, ty = y + dy; if (inb(tx, ty)) { sum += Math.min(dist[idx(tx, ty)], 6); n++; } else { sum += 6; n++; } }
    v = wp.length / 3; wp.push(x, WATER_Y, y); ws.push(clamp(sum / n / 3.2, 0, 1)); vmap.set(key, v); return v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let near = ter[idx(x, y)] === T_WATER;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy) && ter[idx(x + dx, y + dy)] === T_WATER) { near = true; break; }
    if (!near) continue;
    const a = vert(x, y), b = vert(x + 1, y), c2 = vert(x, y + 1), d = vert(x + 1, y + 1);
    wi.push(a, c2, b, b, c2, d);
  }
  if (wi.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    wg.setAttribute('aShore', new THREE.Float32BufferAttribute(ws, 1));
    wg.setIndex(wi); wg.computeVertexNormals();
    const wm = new THREE.Mesh(wg, MAT.water); wm.renderOrder = 2; wm.userData.own = true; wm.frustumCulled = false; scene.add(wm); World.meshes.push(wm);
  }
}

// ------------------------------------------------------------------
//  RESOURCE ENTITIES + INSTANCED RENDERING
// ------------------------------------------------------------------
let RESGEO = null;
const ResR = { groups: {} }; // rtype/variant -> {mesh, mesh2, free index list}
const _fa = new THREE.Vector3(), _fq = new THREE.Quaternion();
const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3(), _ry = new THREE.Vector3(0, 1, 0);
// resources render through instanced groups keyed by model (baked model or built-in procedural one)
function resourceGroupKey(r) {
  if (r.model) return 'm:' + r.model;
  return r.rtype === 'tree' ? r.variant : r.rtype;
}
function buildResourceMeshes(resList) {
  if (!RESGEO) RESGEO = buildResourceModels();
  // trees with a baked model name use it
  for (const r of resList) if (r.rtype === 'tree' && r.variant && !['pine', 'oak', 'birch'].includes(r.variant) && hasModel(r.variant)) r.model = r.variant;
  const counts = {};
  for (const r of resList) { const k = resourceGroupKey(r); counts[k] = (counts[k] || 0) + 1; }
  counts.carcass = 80; for (const mm of ['meat_ham', 'meat_steak', 'meat_fish']) if (hasModel(mm)) counts['m:' + mm] = 60; counts.stump = Math.max(1, resList.filter(r => r.rtype === 'tree').length);
  for (const k of ['pine', 'oak', 'birch', 'gold', 'stone', 'berry']) if (!counts[k]) counts[k] = 0;
  for (const k in counts) {
    const cap = Math.max(1, counts[k] + (k.startsWith('m:') ? 4 : 0));
    const grp = { cap, n: 0, meshes: [] };
    const mk = (geo, mat, colorize) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.frustumCulled = false; m.castShadow = Settings.quality !== 'low'; m.receiveShadow = false; if (colorize) for (let i = 0; i < cap; i++) m.setColorAt(i, new THREE.Color(1, 1, 1)); m.count = 0; scene.add(m); World.meshes.push(m); grp.meshes.push(m); return m; };
    if (k.startsWith('m:')) {
      const name = k.slice(2), md = CHARS[name];
      const isTree = resList.some(r => r.model === name && r.rtype === 'tree');
      if (md) { if (isTree) { mk(new THREE.BufferGeometry(), MAT.vc); mk(md.idle, MAT.canopy, true); } else mk(md.idle, MAT.vc); }
    }
    else if (k === 'pine' || k === 'oak') { mk(RESGEO.trunk, MAT.vc); mk(RESGEO[k], MAT.canopy, true); }
    else if (k === 'birch') { mk(RESGEO.stump, MAT.vc); mk(RESGEO.birch, MAT.canopy, true); }
    else if (RESGEO[k]) mk(RESGEO[k], MAT.vc);
    ResR.groups[k] = grp;
  }
  for (const r of resList) spawnResource(r);
  for (const k in ResR.groups) for (const m of ResR.groups[k].meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
function setResInstance(r, visible) {
  const g = ResR.groups[resourceGroupKey(r)]; if (!g || r.inst < 0) return;
  const cx = r.tx + r.size / 2, cz = r.ty + r.size / 2;
  let sc = r.scale || 1;
  if (r.rtype === 'gold' || r.rtype === 'stone' || r.rtype === 'treasure') sc *= 0.75 + 0.25 * Math.min(1, r.amount / (r.max || 1)) + 0.25;
  if (r.rtype === 'berry') sc *= 0.7 + 0.3 * (r.amount / r.max);
  if (r.rtype === 'carcass' && r.model) sc *= 0.55 + 0.45 * (r.amount / r.max);
  if (!visible) sc = 0.00001;
  _rq.setFromAxisAngle(_ry, r.rot || 0);
  _rp.set(cx, heightAt(cx, cz) - 0.03, cz);
  if (r.rtype === 'tree' && r.felled) {
    const f = r.fall === undefined ? 1 : r.fall, ang = f * f * 1.48;
    _fa.set(Math.cos(r.fallDir), 0, -Math.sin(r.fallDir));
    _fq.setFromAxisAngle(_fa, ang); _rq.premultiply(_fq);
    sc *= 0.55 + 0.45 * Math.max(0, r.amount / r.max);
    _rp.y += 0.08 * f;
  }
  _rs.set(sc, sc * (r.hs || 1), sc);
  _rm.compose(_rp, _rq, _rs);
  for (const m of g.meshes) { m.setMatrixAt(r.inst, _rm); m.instanceMatrix.needsUpdate = true; }
}
function spawnResource(def) {
  const key = resourceGroupKey(def);
  const g = ResR.groups[key];
  const amount = def.amount || (def.rtype === 'tree' ? 100 : def.rtype === 'carcass' ? 100 : 100);
  const r = { id: nextId++, kind: 'resource', rtype: def.rtype, variant: def.variant, model: def.model, res: { tree: 'wood', gold: 'gold', stone: 'stone', berry: 'food', carcass: 'food', treasure: 'gold' }[def.rtype],
    tx: def.tx, ty: def.ty, size: def.size, amount, max: amount, x: def.tx + def.size / 2, z: def.ty + def.size / 2, inst: -1, dead: false,
    scale: def.rtype === 'tree' ? 0.85 + Math.random() * 0.4 : def.rtype === 'gold' || def.rtype === 'stone' ? 1 : 1, rot: Math.random() * Math.PI * 2, hs: def.rtype === 'tree' ? 0.85 + Math.random() * 0.35 : 1 };
  if (def.rtype === 'gold' || def.rtype === 'stone') r.scale = r.model ? 0.95 : 1.05;
  if (def.rtype === 'treasure') { r.scale = 1; r.rot = Math.random() < 0.5 ? 0 : Math.PI; }
  if (r.model && r.rtype === 'tree') { r.scale = 0.85 + Math.random() * 0.35; r.hs = 0.9 + Math.random() * 0.25; }
  if (g) {
    if (g.free && g.free.length) r.inst = g.free.pop();
    else if (g.n < g.cap) { r.inst = g.n++; for (const m of g.meshes) m.count = g.n; }
    if (r.inst >= 0 && key !== 'carcass' && g.meshes[1] && g.meshes[1].instanceColor) {
      const cc = r.model ? new THREE.Color().setHSL(0.2, 0.12, 0.74 + Math.random() * 0.16).convertSRGBToLinear() : (key === 'birch' ? new THREE.Color().setHSL(0.2, 0.15, 0.9 + Math.random() * 0.1) : new THREE.Color().setHSL(0.27 + Math.random() * 0.08, 0.35 + Math.random() * 0.2, 0.75 + Math.random() * 0.25)).convertSRGBToLinear();
      g.meshes[1].setColorAt(r.inst, cc);
    }
    setResInstance(r, true);
  }
  ents.set(r.id, r); resources.push(r);
  if (def.rtype !== 'carcass') for (let y = r.ty; y < r.ty + r.size; y++) for (let x = r.tx; x < r.tx + r.size; x++) { World.occ[idx(x, y)] = r.id; World.pass[idx(x, y)] = 1; }
  return r;
}
function addStump(x, z) {
  const g = ResR.groups.stump; if (!g || g.n >= g.cap) return;
  const i = g.n++; for (const m of g.meshes) m.count = g.n;
  _rq.setFromAxisAngle(_ry, Math.random() * 6.28); _rp.set(x + rand(-0.1, 0.1), heightAt(x, z) - 0.04, z + rand(-0.1, 0.1)); const k = rand(0.8, 1.15); _rs.set(k, k, k);
  _rm.compose(_rp, _rq, _rs); for (const m of g.meshes) { m.setMatrixAt(i, _rm); m.instanceMatrix.needsUpdate = true; }
}
function removeResource(r) {
  if (r.dead) return;
  if (r.rtype !== 'carcass' && World.removed) World.removed.push(r.tx + ',' + r.ty);
  r.dead = true; r.amount = 0;
  setResInstance(r, false);
  const g = ResR.groups[resourceGroupKey(r)];
  if (g && r.inst >= 0) { (g.free || (g.free = [])).push(r.inst); }
  if (r.rtype !== 'carcass') for (let y = r.ty; y < r.ty + r.size; y++) for (let x = r.tx; x < r.tx + r.size; x++) { if (World.occ[idx(x, y)] === r.id) { World.occ[idx(x, y)] = 0; World.pass[idx(x, y)] = 0; } }
  ents.delete(r.id);
  Minimap.dirty = true;
  if (r.rtype === 'tree') { PFX.dust(r.x, heightAt(r.x, r.z) + 0.3, r.z, 4, 0.4); addStump(r.tx + 0.5, r.ty + 0.5); }
}

// ------------------------------------------------------------------
//  FOG OF WAR (vision per player; texture for the human)
// ------------------------------------------------------------------
const DISC = {};
function discOffsets(r) {
  r = Math.round(r); if (DISC[r]) return DISC[r];
  const out = []; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) out.push(x, y);
  return (DISC[r] = out);
}
function stampVision(p, x, z, r) {
  const off = discOffsets(r), cx = Math.floor(x), cy = Math.floor(z), vis = p.vis, exp = p.exp;
  for (let k = 0; k < off.length; k += 2) { const tx = cx + off[k], ty = cy + off[k + 1]; if (tx < 0 || ty < 0 || tx >= N || ty >= N) continue; const i = ty * N + tx; vis[i] = 1; exp[i] = 1; }
}
function computeVision() {
  for (let pi = 0; pi < 2; pi++) players[pi].vis.fill(0);
  for (const u of units) { if (u.dead || u.garrisonIn || u.owner > 1) continue; stampVision(players[u.owner], u.x, u.z, ustat(u.owner, u.type).los); }
  for (const b of buildings) { if (b.dead || b.owner > 1) continue; stampVision(players[b.owner], b.x, b.z, b.built ? BUILDINGS[b.type].los + b.size / 2 : 2 + b.size / 2); }
}
let fogCur = new Float32Array(N * N);
function updateFogTexture(dt, revealAll) {
  const p = players[HUMAN]; const k = Math.min(1, dt * 5);
  for (let i = 0; i < N * N; i++) {
    const tgt = revealAll ? 1 : p.vis[i] ? 1 : p.exp[i] ? 0.48 : 0;
    const c = fogCur[i] += (tgt - fogCur[i]) * k;
    fogData[i * 4] = c * 255;
  }
  fogTex.needsUpdate = true;
}

// ------------------------------------------------------------------
//  DECORATION — grass tufts, flowers, pebbles, shrubs (instanced)
// ------------------------------------------------------------------
function buildDecorations() {
  World.deco = new Map();
  const TH = World.theme;
  const rng = mulberry32(World.seed * 31 + 7);
  const q = Settings.quality === 'low' ? 0.3 : Settings.quality === 'medium' ? 0.7 : 1.1;
  const cap = { low: 3500, medium: 9000, high: 16000 }[Settings.quality] || 9000;
  const sizeK = Math.min(1, (120 * 120) / (N * N) * 1.4); // keep totals bounded on huge maps
  const items = {};
  const add = (name, x, z, ti, s) => { if (!name) return; (items[name] || (items[name] = [])).push([x, z, ti, s]); };
  const pickL = list => { const ok = (list || []).filter(hasModel); return ok.length ? ok[(rng() * ok.length) | 0] : null; };
  const S = World.starts;
  let total = 0;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    if (total > cap) break;
    const i = idx(x, y), t = World.ter[i];
    if (t === T_WATER) continue;
    const o = World.occ[i]; const e = o ? ents.get(o) : null;
    if (e && e.rtype !== 'tree') continue;
    if (!e && World.pass[i]) continue;
    if (Math.min(Math.hypot(x + 0.5 - S[0].x, y + 0.5 - S[0].y), Math.hypot(x + 0.5 - S[1].x, y + 0.5 - S[1].y)) < 2.8) continue;
    const px = () => x + 0.1 + rng() * 0.8, pz = () => y + 0.1 + rng() * 0.8;
    const k = q * sizeK;
    if (t === T_GRASS || t === T_HILL) {
      if (rng() < 0.55 * k) { add(pickL(TH.tuft), px(), pz(), i, 0.8 + rng() * 0.6); total++; }
      if (!e && rng() < 0.06 * k) { add(pickL(TH.flower), px(), pz(), i, 0.8 + rng() * 0.5); total++; }
      if (rng() < (e ? 0.14 : 0.025) * k) { add(pickL(TH.shrub), px(), pz(), i, 0.7 + rng() * 0.6); total++; }
    } else if (t === T_DIRT) { if (rng() < 0.15 * k) { add(pickL(TH.tuft), px(), pz(), i, 0.7 + rng() * 0.4); total++; } if (rng() < 0.05 * k) { add(pickL(TH.pebble), px(), pz(), i, 0.8 + rng() * 0.5); total++; } }
    else if (t === T_SAND) { if (rng() < 0.04 * k) { add(pickL(TH.pebble), px(), pz(), i, 0.8 + rng() * 0.5); total++; } }
    if (t === T_HILL && rng() < 0.04 * k) { add(pickL(TH.pebble), px(), pz(), i, 0.9 + rng() * 0.6); total++; }
  }
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), cc = new THREE.Color();
  for (const name in items) {
    const md = CHARS[name]; if (!md) continue;
    const list = items[name];
    const swayable = !/pebble|rock|grave|crystal|lantern|jacko|pumpkin|ribcage|post/.test(name);
    const m = new THREE.InstancedMesh(md.idle, swayable ? MAT.grass : MAT.vc, list.length);
    m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false;
    list.forEach(([x, z, ti, s], n) => {
      qq.setFromAxisAngle(_ry, rng() * 6.28);
      pp.set(x, heightAt(x, z) - 0.02, z); ss.set(s, s * (0.85 + rng() * 0.3), s);
      m4.compose(pp, qq, ss); m.setMatrixAt(n, m4);
      if (swayable) m.setColorAt(n, cc.setHSL(0.25, 0.12, 0.86 + rng() * 0.14).convertSRGBToLinear());
      let arr = World.deco.get(ti); if (!arr) World.deco.set(ti, arr = []); arr.push([m, n]);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    scene.add(m); World.meshes.push(m);
  }
}
function hideDecoration(tx, ty, s) {
  if (!World.deco) return;
  const z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let y = ty; y < ty + s; y++) for (let x = tx; x < tx + s; x++) {
    const arr = World.deco.get(idx(x, y)); if (!arr) continue;
    for (const [m, n] of arr) { m.setMatrixAt(n, z); m.instanceMatrix.needsUpdate = true; }
    World.deco.delete(idx(x, y));
  }
}
// ------------------------------------------------------------------
//  SCENERY & VILLAGE PROPS (baked models). Mirrored for fairness;
//  solid props block movement where they stand.
// ------------------------------------------------------------------
// landscape props are modelled on a square ground slab: find its top so the slab can be buried
const _slab = {};
function slabSink(name) {
  if (_slab[name] !== undefined) return _slab[name];
  const g = CHARS[name] && CHARS[name].idle; if (!g) return 0;
  g.computeBoundingBox(); const bb = g.boundingBox, P = g.attributes.position, H = bb.max.y - bb.min.y, full = bb.max.x - bb.min.x, B = 40;
  const mn = new Float32Array(B).fill(1e9), mx = new Float32Array(B).fill(-1e9);
  for (let i = 0; i < P.count; i++) { const b = Math.min(B - 1, ((P.getY(i) - bb.min.y) / H * B) | 0), x = P.getX(i); if (x < mn[b]) mn[b] = x; if (x > mx[b]) mx[b] = x; }
  let top = 0; for (let b = 0; b < B * 0.5; b++) { if (mx[b] < mn[b]) continue; if (mx[b] - mn[b] >= full * 0.93) top = b + 1; else break; }
  return (_slab[name] = clamp(top / B * H - 0.02, 0, H * 0.45));
}
function placeProps() {
  World.props = []; World.ambient = [];
  const TH = World.theme;
  const rng = mulberry32(World.seed * 13 + 3);
  const S = World.starts;
  const free = (tx, ty, s, m, nearWater) => {
    let water = false;
    for (let y = ty - m; y < ty + s + m; y++) for (let x = tx - m; x < tx + s + m; x++) {
      if (!inb(x, y) || x < 2 || y < 2 || x > N - 3 || y > N - 3) return false;
      const i = idx(x, y);
      if (World.ter[i] === T_WATER) { water = true; if (x >= tx && x < tx + s && y >= ty && y < ty + s) return false; continue; }
      if (World.pass[i] || World.occ[i]) return false;
    }
    return nearWater ? water : true;
  };
  const block = (tx, ty, s) => { for (let y = ty; y < ty + s; y++) for (let x = tx; x < tx + s; x++) World.pass[idx(x, y)] = 1; };
  const meshOf = name => { const md = CHARS[name]; if (!md) return null; const m = new THREE.Mesh(md.idle, MAT.vc); m.castShadow = Settings.quality !== 'low'; m.receiveShadow = true; return m; };
  const put = (name, x, z, rot, opts = {}) => {
    const m = meshOf(name); if (!m) return null;
    m.position.set(x, (opts.y !== undefined ? opts.y : heightAt(x, z)) - (opts.sink || 0), z); m.rotation.y = rot;
    if (opts.scale) m.scale.setScalar(opts.scale);
    scene.add(m); World.meshes.push(m); return m;
  };
  const add = (name, tx, ty, s, sink, rot, blocks = true) => {
    if (!hasModel(name)) return false;
    let h = 1e9; for (let y = ty; y <= ty + s; y++) for (let x = tx; x <= tx + s; x++) h = Math.min(h, World.vh[y * (N + 1) + x]);
    put(name, tx + s / 2, ty + s / 2, rot, { y: h, sink });
    if (blocks) block(tx, ty, s);
    World.props.push({ name, tx, ty, s });
    return true;
  };
  const mirrored = (name, s, sink, pickFn, tries = 300, nearWater = false, blocks = true) => {
    if (!hasModel(name)) return false;
    for (let k = 0; k < tries; k++) {
      const p = pickFn(); if (!p) continue;
      const [tx, ty] = p, mx = N - tx - s, my = N - ty - s;
      if (!free(tx, ty, s, blocks ? 1 : 0, nearWater) || !free(mx, my, s, blocks ? 1 : 0, nearWater)) continue;
      const rot = Math.floor(rng() * 4) * Math.PI / 2;
      add(name, tx, ty, s, sink, rot, blocks); add(name, mx, my, s, sink, rot + Math.PI, blocks);
      return true;
    }
    return false;
  };
  const around = (cx, cy, d0, d1) => () => { const a = rng() * Math.PI * 2, d = d0 + rng() * (d1 - d0); return [Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d)]; };
  const anywhere = () => { const tx = 4 + ((rng() * (N - 10)) | 0), ty = 4 + ((rng() * (N - 10)) | 0); return tx + ty < N - 16 && Math.hypot(tx - S[0].x, ty - S[0].y) > 20 ? [tx, ty] : null; };
  // --- village plaza around each Town Center ---
  mirrored('fountain', 2, 0, around(S[0].x, S[0].y, 5.5, 7));
  mirrored('well', 1, 0, around(S[0].x, S[0].y, 5, 7));
  for (const n of ['market_1', 'market_2']) mirrored(n, 2, 0, around(S[0].x, S[0].y, 6, 9));
  for (const n of ['cart', 'hay', 'bonfire', 'm_bench', 'lantern', 'lantern', 'm_barrel', 'm_crate', 'p_bench', 'cauldron']) mirrored(n, 1, 0, around(S[0].x, S[0].y, 5, 9), 120);
  for (const n of ['p_tree', 'p_bush_large', 'p_bush', 'hedge_long']) mirrored(n, n === 'hedge_long' ? 2 : 1, 0, around(S[0].x, S[0].y, 7, 10), 120);
  // statues and monuments around the plaza
  for (const n of ['horse_statue', 'stag_statue', 'monument']) mirrored(n, 2, 0, around(S[0].x, S[0].y, 7, 11), 160);
  for (const n of ['wheat', 'wheat', 'big_barn']) mirrored(n, n === 'big_barn' ? 3 : 1, 0, around(S[0].x, S[0].y, 9, 13), 160);
  // --- landmarks ---
  for (const n of TH.props) {
    const s = n === 'nature' ? 4 : n === 'pond' || n === 'waterfall' || n === 'castle_tower' ? 3 : 2;
    const sink = n === 'nature' || n === 'pond' || n === 'waterfall' ? Math.max(slabSink(n), 0.1) : 0.05;
    if (n === 'waterfall') { if (!mirrored(n, s, sink, anywhere, 400, true)) mirrored(n, s, sink, anywhere); }
    else mirrored(n, s, sink, anywhere);
  }
  // --- camp dressing ---
  for (const c of World.camps || []) {
    const sets = { wolves: ['log_fall', 'log_fall_large', 'm_rocks', 'campfire', 'signpost'], pirates: ['tent', 'tent_half', 'campfire', 'cannon', 'pr_barrel', 's_box', 'palisade', 'palisade'],
      raptors: ['crystal_5', 'crystal_6', 'crystal_7', 'crystal_8', 'log_fall', 'ribcage'], graveyard: ['crypt', 'grave', 'grave_2', 'gravestone', 'gravestone_2', 'iron_fence', 'iron_fence_d', 'post_lantern', 'coffin', 'arch'] }[c.kind] || [];
    let k = 0;
    for (const n of sets) {
      if (!hasModel(n)) continue;
      const s = n === 'crypt' ? 2 : 1;
      for (let t = 0; t < 30; t++) {
        const a = (k * 0.9 + t * 0.37) + (c.tx * 0.1), d = 2.5 + (t % 3) * 0.8 + (s - 1);
        const tx = Math.round(c.tx + Math.cos(a) * d), ty = Math.round(c.ty + Math.sin(a) * d);
        if (!free(tx, ty, s, 0)) continue;
        add(n, tx, ty, s, 0, Math.atan2(c.tx - tx, c.ty - ty), !/lantern|grave|gravestone|coffin|ribcage|crystal_[78]/.test(n)); k++; break;
      }
    }
  }
  // --- coast: docks on the shore, ships & sea life sailing the bays ---
  if (TH.coastal) {
    for (const n of ['dock', 'dock_broken', 'fishing_stand']) mirrored(n, 2, 0.05, anywhere, 600, true);
    for (const n of ['pr_house', 'pr_house_2', 'pr_house_3']) mirrored(n, 2, 0, anywhere, 300);
    const bays = [[N * 0.1, N * 0.9], [N * 0.9, N * 0.1]];
    for (const [bx, bz] of bays) {
      for (const [n, r0, sp] of [['ship', N * 0.12, 0.03], ['small_ship', N * 0.07, -0.05], ['a_dolphin', N * 0.09, 0.08], ['a_whale', N * 0.15, 0.02], ['shark', N * 0.05, -0.1]]) {
        const m = meshOf(n); if (!m) continue;
        scene.add(m); World.meshes.push(m);
        World.ambient.push({ m, kind: n.startsWith('a_') || n === 'shark' ? 'swim' : 'sail', cx: bx, cz: bz, r: r0, sp, ph: rng() * 6.28 });
      }
    }
  }
  // kayaks on lakes
  if (hasModel('kayak')) {
    let placed = 0;
    for (let k = 0; k < 4000 && placed < 3; k++) {
      const tx = 3 + ((rng() * (N - 6)) | 0), ty = 3 + ((rng() * (N - 6)) | 0);
      if (tx + ty >= N - 1 || World.ter[idx(tx, ty)] !== T_WATER || World.ter[idx(N - 1 - tx, N - 1 - ty)] !== T_WATER) continue;
      put('kayak', tx + 0.5, ty + 0.5, rng() * 6, { y: WATER_Y - 0.03 }); put('kayak', N - tx - 0.5, N - ty - 0.5, rng() * 6, { y: WATER_Y - 0.03 });
      placed++;
    }
  }
  // birds circling over forests
  for (let k = 0; k < Math.round(4 * N / 120); k++) {
    const n = hasModel('a_bird') ? 'a_bird' : hasModel('pr_bird') ? 'pr_bird' : null; if (!n) break;
    const m = meshOf(n); m.castShadow = false; scene.add(m); World.meshes.push(m);
    World.ambient.push({ m, kind: 'fly', cx: 10 + rng() * (N - 20), cz: 10 + rng() * (N - 20), r: 4 + rng() * 6, sp: (0.25 + rng() * 0.2) * (rng() < 0.5 ? -1 : 1), ph: rng() * 6.28, h: 5 + rng() * 3 });
  }
  Minimap.dirty = true;
}
// moving scenery (ships, sea life, birds)
function updateAmbient(t) {
  for (const a of World.ambient || []) {
    const ang = a.ph + t * a.sp, x = a.cx + Math.cos(ang) * a.r, z = a.cz + Math.sin(ang) * a.r;
    const dir = Math.atan2(-Math.sin(ang) * Math.sign(a.sp), Math.cos(ang) * Math.sign(a.sp));
    if (a.kind === 'fly') a.m.position.set(x, heightAt(clamp(x, 0, N), clamp(z, 0, N)) + a.h + Math.sin(t * 2 + a.ph) * 0.3, z);
    else if (a.kind === 'sail') { a.m.position.set(x, WATER_Y - 0.05 + Math.sin(t * 1.3 + a.ph) * 0.05, z); a.m.rotation.z = Math.sin(t * 0.9 + a.ph) * 0.04; }
    else { const dive = Math.sin(t * 0.8 + a.ph); a.m.position.set(x, WATER_Y - 0.5 + Math.max(0, dive) * 0.7, z); a.m.rotation.x = -Math.cos(t * 0.8 + a.ph) * 0.4; }
    a.m.rotation.y = dir;
    a.m.visible = Game.mode !== 'play' || Game.reveal || (players[HUMAN] && players[HUMAN].exp[idx(clamp(x | 0, 0, N - 1), clamp(z | 0, 0, N - 1))]);
  }
}
