// =====================================================================
//  PATHFINDING — grid A* (8-dir, no corner cutting) + string pulling,
//  processed from a time-budgeted request queue.
// =====================================================================
const PF = { gen: 0, queue: [] };
function allocPathfinder() {
  PF.g = new Float32Array(N * N); PF.par = new Int32Array(N * N); PF.stamp = new Uint32Array(N * N); PF.closed = new Uint32Array(N * N);
  PF.heap = new MinHeap(N * N * 6); PF.gen = 0;
}
allocPathfinder();
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

// isGoal(x,y) -> bool ; (hx,hy) heuristic target
function astar(sx, sy, isGoal, hx, hy, owner, maxIter = 9000) {
  const { g, par, stamp, closed, heap } = PF;
  const gen = ++PF.gen;
  heap.clear();
  const heur = (x, y) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
  const si = sy * N + sx;
  g[si] = 0; stamp[si] = gen; par[si] = -1; heap.push(si, heur(sx, sy));
  let best = si, bestH = Infinity, it = 0, found = -1;
  while (heap.n > 0 && it++ < maxIter) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    const cx = cur % N, cy = (cur / N) | 0;
    if (isGoal(cx, cy)) { found = cur; break; }
    const hh = heur(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d][0], dy = DIRS[d][1];
      const nx = cx + dx, ny = cy + dy;
      if (!tileFree(nx, ny, owner)) continue;
      if (dx && dy && (!tileFree(cx + dx, cy, owner) || !tileFree(cx, cy + dy, owner))) continue;
      const ni = ny * N + nx;
      if (closed[ni] === gen) continue;
      const ng = g[cur] + DIRS[d][2];
      if (stamp[ni] !== gen || ng < g[ni]) { stamp[ni] = gen; g[ni] = ng; par[ni] = cur; heap.push(ni, ng + heur(nx, ny) * 1.05); }
    }
  }
  const end = found >= 0 ? found : best;
  const out = [];
  let c = end, guard = 0;
  while (c !== -1 && c !== si && guard++ < N * N) { out.push(c); c = par[c]; }
  out.reverse();
  return { tiles: out, complete: found >= 0 };
}

// does a straight segment stay on free tiles (with a little clearance)?
function lineFree(x0, z0, x1, z1, owner, clr = 0.22) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return posFree(x1, z1, owner);
  const steps = Math.ceil(len / 0.3), px = -dz / len * clr, pz = dx / len * clr;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = x0 + dx * t, z = z0 + dz * t;
    if (!posFree(x, z, owner) || !posFree(x + px, z + pz, owner) || !posFree(x - px, z - pz, owner)) {
      if (i === 0) continue; // allow leaving a tight spot
      return false;
    }
  }
  return true;
}
function smoothPath(tiles, sx, sz, owner, endPt) {
  const pts = tiles.map(t => ({ x: (t % N) + 0.5, z: ((t / N) | 0) + 0.5 }));
  if (endPt && pts.length) pts[pts.length - 1] = endPt;
  const out = []; let cx = sx, cz = sz, i = 0;
  while (i < pts.length) {
    let j = Math.min(pts.length - 1, i + 14);
    while (j > i && !lineFree(cx, cz, pts[j].x, pts[j].z, owner)) j--;
    out.push(pts[j]); cx = pts[j].x; cz = pts[j].z; i = j + 1;
  }
  return out;
}
// nearest free tile to (x,z) (spiral BFS)
function nearestFree(x, z, owner, maxR = 10) {
  const cx = Math.floor(x), cy = Math.floor(z);
  if (tileFree(cx, cy, owner)) return { x: cx + 0.5, z: cy + 0.5 };
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let y = cy - r; y <= cy + r; y++) for (let xx = cx - r; xx <= cx + r; xx++) {
      if (Math.abs(y - cy) !== r && Math.abs(xx - cx) !== r) continue;
      if (!tileFree(xx, y, owner)) continue;
      const d = dist2(xx + 0.5, y + 0.5, x, z); if (d < bd) { bd = d; best = { x: xx + 0.5, z: y + 0.5 }; }
    }
    if (best) return best;
  }
  return null;
}
// closest point to (x,z) on an entity rect, pushed out by `pad`
function rectOf(e) { if (e.kind === 'building') return [e.tx, e.ty, e.size]; if (e.kind === 'resource') return [e.tx, e.ty, e.size]; return null; }
function edgePoint(e, x, z, pad = 0.45) {
  const [tx, ty, s] = rectOf(e);
  const px = clamp(x, tx, tx + s), pz = clamp(z, ty, ty + s);
  let dx = x - px, dz = z - pz; let d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.001) { dx = x - (tx + s / 2); dz = z - (ty + s / 2); d = Math.sqrt(dx * dx + dz * dz) || 1; return { x: tx + s / 2 + dx / d * (s / 2 + pad), z: ty + s / 2 + dz / d * (s / 2 + pad) }; }
  return { x: px + dx / d * pad, z: pz + dz / d * pad };
}

// request a path; processed later within a time budget
function requestPath(u, gx, gz, tgt) {
  u.pathReq = { gx, gz, tgt: tgt ? tgt.id : 0 };
  u.waitPath = true;
  if (!u.inQueue) { u.inQueue = true; PF.queue.push(u); }
}
function processPathQueue(budgetMs) {
  const t0 = performance.now();
  let n = 0;
  while (PF.queue.length && (n < 2 || performance.now() - t0 < budgetMs)) {
    const u = PF.queue.shift(); u.inQueue = false; n++;
    if (u.dead || !u.pathReq) { u.waitPath = false; continue; }
    computePath(u);
  }
}
function computePath(u) {
  const req = u.pathReq; u.pathReq = null; u.waitPath = false;
  const tgt = req.tgt ? ents.get(req.tgt) : null;
  const sx = clamp(Math.floor(u.x), 0, N - 1), sy = clamp(Math.floor(u.z), 0, N - 1);
  let path = null, complete = true;
  if (tgt && (tgt.kind === 'building' || tgt.kind === 'resource') && !(tgt.kind === 'building' && BUILDINGS[tgt.type].walk)) {
    const [tx, ty, s] = rectOf(tgt);
    const ep = edgePoint(tgt, u.x, u.z, 0.42);
    if (lineFree(u.x, u.z, ep.x, ep.z, u.owner) && posFree(ep.x, ep.z, u.owner)) path = [ep];
    else {
      const isGoal = (x, y) => x >= tx - 1 && x <= tx + s && y >= ty - 1 && y <= ty + s && !(x >= tx && x < tx + s && y >= ty && y < ty + s);
      const r = astar(sx, sy, isGoal, tx + s / 2, ty + s / 2, u.owner);
      complete = r.complete;
      path = smoothPath(r.tiles, u.x, u.z, u.owner);
    }
  } else {
    let gx = req.gx, gz = req.gz;
    if (!posFree(gx, gz, u.owner)) { const nf = nearestFree(gx, gz, u.owner, 8); if (nf) { gx = nf.x; gz = nf.z; } }
    if (lineFree(u.x, u.z, gx, gz, u.owner)) path = [{ x: gx, z: gz }];
    else {
      const tgx = clamp(Math.floor(gx), 0, N - 1), tgy = clamp(Math.floor(gz), 0, N - 1);
      const r = astar(sx, sy, (x, y) => x === tgx && y === tgy, tgx, tgy, u.owner);
      complete = r.complete;
      path = smoothPath(r.tiles, u.x, u.z, u.owner, r.complete ? { x: gx, z: gz } : null);
    }
  }
  u.path = path; u.pi = 0; u.pathOk = complete; u.stuckT = 0; u.lastProgX = u.x; u.lastProgZ = u.z;
  if (!complete) u.pathFails = (u.pathFails || 0) + 1; else u.pathFails = 0;
}
