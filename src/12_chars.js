// =====================================================================
//  MODEL LIBRARY — pre-baked packs (models/*.js, built by tools/bake.html
//  from poly.pizza models). Packs are plain scripts so the game works
//  straight from the file system. Models are decoded lazily on first use.
//    static model:  quantized triangles + per-face colours
//    animated:      bind mesh + skin weights + per-frame bone matrices,
//                   expanded into instanced pose frames
// =====================================================================
const IV_RAW = {};
const PACKS_LOADED = new Set();
function IV_PACK(name, models) { Object.assign(IV_RAW, models); PACKS_LOADED.add(name); }
// packs loaded by <script> tags before the game code are queued, drain them now
if (window.__IVQ) for (const [n, m] of window.__IVQ) IV_PACK(n, m);
function loadPack(name) {
  if (PACKS_LOADED.has(name)) return Promise.resolve(true);
  return new Promise(res => {
    const s = document.createElement('script');
    s.src = 'models/' + name + '.js';
    s.onload = () => res(true);
    s.onerror = () => { console.warn('model pack missing:', name); res(false); };
    document.head.appendChild(s);
  });
}
function unb64(s, Type) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}
const _decoded = {};
function decodeStatic(d) {
  const Q = unb64(d.pos, Int16Array), C = unb64(d.col, Uint8Array), T = d.T, b = d.box;
  const pos = new Float32Array(T * 9), col = new Float32Array(T * 9);
  for (let i = 0; i < T * 9; i++) { const k = i % 3; pos[i] = b[k] + (Q[i] + 32768) / 65535 * b[3 + k]; }
  for (let t = 0; t < T; t++) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) { const c = C[t * 3 + k] / 255; col[t * 9 + v * 3 + k] = c * c; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  return { frames: { idle: [g], walk: [g], attack: [g], work: [g], death: [g] }, animated: false, idle: g, tris: T };
}
function decodeAnimated(d) {
  const P = unb64(d.pos, Float32Array), I = unb64(d.idx, Uint16Array), C = unb64(d.col, Uint8Array), SK = unb64(d.sk, Uint8Array), SW = unb64(d.sw, Uint8Array);
  const V = d.V, T = d.T, B = d.B;
  const col = new THREE.BufferAttribute(new Float32Array(T * 9), 3);
  for (let t = 0; t < T; t++) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) { const c = C[t * 3 + k] / 255; col.array[t * 9 + v * 3 + k] = c * c; }
  const sk = new Float32Array(V * 3);
  const frame = (M, f) => {
    const o = f * B * 12;
    for (let i = 0; i < V; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; let rx = 0, ry = 0, rz = 0;
      for (let k = 0; k < 4; k++) {
        const w = SW[i * 4 + k] / 255; if (!w) continue;
        const m = o + SK[i * 4 + k] * 12;
        rx += w * (M[m] * x + M[m + 3] * y + M[m + 6] * z + M[m + 9]);
        ry += w * (M[m + 1] * x + M[m + 4] * y + M[m + 7] * z + M[m + 10]);
        rz += w * (M[m + 2] * x + M[m + 5] * y + M[m + 8] * z + M[m + 11]);
      }
      sk[i * 3] = rx; sk[i * 3 + 1] = ry; sk[i * 3 + 2] = rz;
    }
    const pos = new Float32Array(T * 9);
    for (let t = 0; t < T; t++) for (let v = 0; v < 3; v++) { const s = I[t * 3 + v]; pos[t * 9 + v * 3] = sk[s * 3]; pos[t * 9 + v * 3 + 1] = sk[s * 3 + 1]; pos[t * 9 + v * 3 + 2] = sk[s * 3 + 2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', col);
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  };
  const frames = {};
  for (const st in d.clips) { const c = d.clips[st], M = unb64(c.m, Float32Array); frames[st] = []; for (let f = 0; f < c.n; f++) frames[st].push(frame(M, f)); }
  const idle = frames.idle[0];
  for (const st of ['walk', 'attack', 'work', 'death']) if (!frames[st]) frames[st] = [idle];
  idle.computeBoundingBox();
  return { frames, animated: true, idle, tris: T };
}
// CHARS[name] -> decoded model (or undefined when its pack is not loaded)
const CHARS = new Proxy(_decoded, {
  get(t, k) {
    if (typeof k !== 'string') return undefined;
    if (k in t) return t[k];
    const d = IV_RAW[k]; if (!d) return undefined;
    try { return (t[k] = d.k === 'a' ? decodeAnimated(d) : decodeStatic(d)); } catch (e) { console.warn('decode failed', k, e); return (t[k] = undefined); }
  },
  has(t, k) { return k in t || k in IV_RAW; },
});
const hasModel = n => !!IV_RAW[n];
const modelList = prefix => Object.keys(IV_RAW).filter(k => k.startsWith(prefix)).sort();
