// =====================================================================
//  RENDER — renderer, materials (fog-of-war aware), procedural models
// =====================================================================
let renderer, scene, camera, sun, hemi;
const U = { uTime: { value: 0 }, uFog: { value: null }, uMapN: { value: 128 }, uSnow: { value: 0 }, uWet: { value: 0 }, uWind: { value: 1 }, uCloud: { value: null }, uDay: { value: 1, raw: 1 }, uSky: { value: new THREE.Color(0xbcd6e8) } };
let fogTex, fogData, whiteTex;
const MAT = {};
const SKY = 0xbcd6e8;
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

function initRenderer() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: Settings.quality !== 'low', powerPreference: 'high-performance' });
  renderer.setClearColor(SKY);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(lin(SKY), 75, 170);
  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.3, 700);
  {
    const g = new THREE.SphereGeometry(320, 32, 16), cols = [], ct = new THREE.Color(0x4f8fd6), ch = new THREE.Color(SKY), cw = new THREE.Color(0xf4e6c8), c = new THREE.Color();
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 320; c.copy(ch).lerp(ct, clamp(y * 1.6, 0, 1)); if (y < 0.12 && y > -0.2) c.lerp(cw, (0.12 - Math.abs(y - 0.02)) * 1.6); c.convertSRGBToLinear(); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    window.skyDome = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyDome.renderOrder = -10; scene.add(skyDome);
  }
  hemi = new THREE.HemisphereLight(0xdfeeff, 0x4a4028, 0.62); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffe9c4, 1.25);
  sun.position.set(30, 50, 20); scene.add(sun); scene.add(sun.target);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  makeFogTexture();
  whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); whiteTex.needsUpdate = true;
  U.uFog.value = fogTex;
  makeMaterials();
  applyQuality();
  onResize();
  window.addEventListener('resize', onResize);
}
function makeFogTexture() {
  if (fogTex) fogTex.dispose();
  fogData = new Uint8Array(N * N * 4).fill(255);
  fogTex = new THREE.DataTexture(fogData, N, N, THREE.RGBAFormat);
  fogTex.magFilter = THREE.LinearFilter; fogTex.minFilter = THREE.LinearFilter; fogTex.needsUpdate = true;
  U.uFog.value = fogTex; U.uMapN.value = N;
}
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (typeof PFX !== 'undefined') PFX.resize();
}
function applyQuality() {
  const q = Settings.quality;
  renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'medium' ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, 1));
  const sh = q !== 'low';
  renderer.shadowMap.enabled = sh;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = sh;
  const sz = q === 'high' ? 4096 : 2048;
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.shadow.mapSize.set(sz, sz);
  if (typeof Post !== 'undefined') Post.sync();
  scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
  onResize();
}

// --- material patch: multiply by fog-of-war texture, optional tree sway / water waves
function patchMat(mat, opt = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uCloud = U.uCloud; sh.uniforms.uDay = U.uDay; sh.uniforms.uSky = U.uSky;
    sh.uniforms.uFog = U.uFog; sh.uniforms.uTime = U.uTime; sh.uniforms.uMapN = U.uMapN; sh.uniforms.uSnow = U.uSnow; sh.uniforms.uWet = U.uWet; sh.uniforms.uWind = U.uWind;
    let vs = 'uniform float uTime;\nuniform float uMapN;\nuniform float uWind;\nvarying vec2 vFogUv;\n' + sh.vertexShader;
    if (opt.sway) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        float sw = (sin(uTime*1.25*uWind + ip.x*0.37 + ip.z*0.23) * 0.055 + sin(uTime*2.9*uWind + ip.x*1.7) * 0.012) * uWind;
        float k = max(position.y - 0.3, 0.0);
        transformed.x += sw * k; transformed.z += sw * 0.6 * k; }
      #endif`);
    if (opt.grass) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { float ix = instanceMatrix[3][0], iz = instanceMatrix[3][2];
        float k = position.y * 2.2 * uWind;
        transformed.x += (sin(uTime*2.1*uWind + ix*0.8 + iz*0.6) * 0.05 + sin(uTime*3.7 + iz) * 0.015) * k;
        transformed.z += cos(uTime*1.7*uWind + ix*0.5) * 0.03 * k; }
      #endif`);
    if (opt.water) vs = 'attribute float aShore;\nvarying float vShore;\n' + vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      vShore = aShore;
      transformed.y += (sin(position.x*0.9 + uTime*1.6)*0.03 + cos(position.z*0.75 + uTime*1.2)*0.03) * (0.3 + 0.7 * aShore) * uWind;`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 fw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fw = instanceMatrix * fw;
      #endif
        fw = modelMatrix * fw; vFogUv = fw.xz / uMapN; }`);
    let fs = 'uniform sampler2D uCloud;\nuniform float uDay;\nuniform vec3 uSky;\nuniform sampler2D uFog;\nuniform float uTime;\nuniform float uMapN;\nuniform float uSnow;\nuniform float uWet;\nvarying vec2 vFogUv;\n' + sh.fragmentShader;
    if (opt.water) {
      // rippling normals -> moving sun glints
      fs = 'varying float vShore;\n' + fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 wn = vFogUv * uMapN;
          normal = normalize(normal + vec3(sin(wn.x*3.1 + uTime*1.9) * 0.07 + sin(wn.y*5.3 - uTime*1.3) * 0.05, 0.0, cos(wn.y*2.7 + uTime*1.5) * 0.07 + sin((wn.x + wn.y)*4.1 + uTime*2.3) * 0.04)); }`);
      // depth colour (turquoise shallows -> deep blue), soft transparent shoreline, animated foam
      fs = fs.replace('#include <dithering_fragment>', `
      { vec2 wq = vFogUv * uMapN;
        float n1 = sin(wq.x*1.7 + uTime*1.1) + sin(wq.y*2.1 - uTime*0.9) + sin((wq.x + wq.y)*1.3 + uTime*0.7);
        float d = clamp(vShore + n1 * 0.025, 0.0, 1.0);
        vec3 wcol = mix(vec3(0.10, 0.46, 0.50), vec3(0.015, 0.11, 0.26), smoothstep(0.05, 0.85, d));
        float lit = dot(gl_FragColor.rgb, vec3(0.3333));
        vec3 spec = max(gl_FragColor.rgb - vec3(lit), 0.0) + vec3(max(lit - 1.15, 0.0));
        float foamBand = smoothstep(0.30, 0.02, d) * (0.55 + 0.45 * sin(d * 46.0 - uTime * 2.2 + n1));
        float foamEdge = smoothstep(0.10, 0.0, d);
        float foam = clamp(foamBand * 0.55 + foamEdge * 0.7, 0.0, 1.0);
        float caust = smoothstep(1.6, 2.6, n1 + sin(wq.x*4.3 - uTime*1.4) * sin(wq.y*3.7 + uTime*1.2)) * (1.0 - d) * 0.25;
        gl_FragColor.rgb = wcol * min(lit, 1.6) * 1.15 + spec * 1.6 + vec3(0.95, 0.98, 1.0) * (foam * 0.55 + caust) * min(lit, 1.4);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.75, 0.82, 0.9) * min(lit, 1.2), uSnow * 0.35);
        float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uSky * min(lit, 1.25), fres * 0.6 * smoothstep(0.05, 0.4, d));
        gl_FragColor.a = clamp(mix(0.35, 0.93, smoothstep(0.0, 0.45, d)) + foam * 0.4 + fres * 0.2, 0.0, 1.0); }
      #include <dithering_fragment>`);
    }
    if (opt.snowy) fs = fs.replace('#include <dithering_fragment>', `
      { float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.95, 1.0) * (0.62 + lum * 0.9), uSnow);
        gl_FragColor.rgb *= 1.0 - uWet * 0.16; }
      #include <dithering_fragment>`);
    fs = fs.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n { vec2 cq = vFogUv * uMapN * 0.016 + vec2(uTime * 0.005, uTime * 0.0035); float cl = texture2D(uCloud, cq).r * 0.62 + texture2D(uCloud, cq * 2.3 + 0.37).r * 0.38; gl_FragColor.rgb *= 1.0 - smoothstep(0.46, 0.7, cl) * 0.24 * uDay; }\n gl_FragColor.rgb *= texture2D(uFog, vFogUv).r;');
    sh.vertexShader = vs; sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'iv' + (opt.sway ? 's' : '') + (opt.water ? 'w' : '') + (opt.grass ? 'g' : '') + (opt.snowy ? 'n' : '');
  return mat;
}

function makeDetailTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 214 + Math.random() * 41; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  // soft blotches
  for (let i = 0; i < 60; i++) { const x = Math.random() * S, y = Math.random() * S, r = 8 + Math.random() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); const d = Math.random() < 0.5; gr.addColorStop(0, d ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // grass blades / strokes
  g.lineWidth = 1;
  for (let i = 0; i < 1400; i++) { const x = Math.random() * S, y = Math.random() * S, l = 2 + Math.random() * 5, a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9; g.strokeStyle = `rgba(${Math.random() < 0.6 ? '0,0,0' : '255,255,230'},${0.06 + Math.random() * 0.1})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(60,50,40,${0.08 + Math.random() * 0.1})`; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 0.6 + Math.random() * 1.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function makeCloudTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 18 + Math.random() * 46, a = 0.1 + Math.random() * 0.16;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeBumpTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 520; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 2 + Math.random() * 9, up = Math.random() < 0.5;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, up ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  const img = g.getImageData(0, 0, S, S); for (let i = 0; i < S * S; i++) { const n = (Math.random() - 0.5) * 26; img.data[i * 4] += n; img.data[i * 4 + 1] += n; img.data[i * 4 + 2] += n; } g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeMaterials() {
  U.uCloud.value = makeCloudTexture();
  MAT.terrain = patchMat(new THREE.MeshPhongMaterial({ vertexColors: true, map: makeDetailTexture(), bumpMap: makeBumpTexture(), bumpScale: 0.07, shininess: 5, specular: 0x0c0c0a }), { snowy: true });
  MAT.water = patchMat(new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 1, shininess: 160, specular: 0x9fb4c4, depthWrite: false }), { water: true });
  MAT.vc = patchMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  MAT.inst = patchMat(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  MAT.canopy = patchMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { sway: true, snowy: true });
  MAT.grass = patchMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { grass: true, snowy: true });
  MAT.team = [0, 1, 2].map(i => patchMat(new THREE.MeshLambertMaterial({ color: lin(TEAM_COL[i]), side: THREE.DoubleSide })));
  MAT.ghostOk = new THREE.MeshBasicMaterial({ color: 0x55ff66, transparent: true, opacity: 0.45, depthWrite: false });
  MAT.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff4433, transparent: true, opacity: 0.45, depthWrite: false });
  MAT.ring = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  MAT.bar = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true });
}

// ------------------------------------------------------------------
//  GEOMETRY HELPERS — parts are baked into one vertex-coloured mesh
// ------------------------------------------------------------------
const _v1 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e1 = new THREE.Euler(), _s1 = new THREE.Vector3();
function mergeParts(parts) {
  let total = 0; const gs = [];
  for (const p of parts) { const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m); gs.push(g); total += g.attributes.position.count; p.g.dispose(); }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0; const c = new THREE.Color();
  gs.forEach((g, i) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    c.set(parts[i].c).convertSRGBToLinear();
    for (let k = 0; k < n; k++) { col[(o + k) * 3] = c.r; col[(o + k) * 3 + 1] = c.g; col[(o + k) * 3 + 2] = c.b; }
    o += n; g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
function roofGeo(w, h, d, ridge = 0) {
  const hw = w / 2, hd = d / 2, r = Math.min(ridge, w) / 2;
  const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd], P1 = [-r, h, 0], P2 = [r, h, 0];
  const tris = [D, C, P2, D, P2, P1, B, A, P1, B, P1, P2, A, D, P1, C, B, P2];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  g.computeVertexNormals();
  return g;
}
class MB {
  constructor() { this.parts = []; }
  add(g, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4();
    m.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1.set(rx, ry, rz)), _s1.set(sx, sy, sz));
    this.parts.push({ g, c, m }); return this;
  }
  box(w, h, d, c, x, yb, z, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), c, x, yb + h / 2, z, 0, ry, 0); }
  boxc(w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz); }
  cyl(rt, rb, h, c, x, yb, z, seg = 8) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, yb + h / 2, z); }
  cylc(rt, rb, h, c, x, y, z, rx = 0, ry = 0, rz = 0, seg = 8) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, rx, ry, rz); }
  cone(r, h, c, x, yb, z, seg = 8, ry = 0) { return this.add(new THREE.ConeGeometry(r, h, seg), c, x, yb + h / 2, z, 0, ry, 0); }
  sph(r, c, x, y, z, sx = 1, sy = 1, sz = 1, ws = 8, hs = 6) { return this.add(new THREE.SphereGeometry(r, ws, hs), c, x, y, z, 0, 0, 0, sx, sy, sz); }
  ico(r, c, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) { return this.add(new THREE.IcosahedronGeometry(r, 0), c, x, y, z, 0, ry, 0, sx, sy, sz); }
  dod(r, c, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) { return this.add(new THREE.DodecahedronGeometry(r, 0), c, x, y, z, 0, ry, 0, sx, sy, sz); }
  roof(w, d, h, c, x, yb, z, ridge = 0, ry = 0) { return this.add(roofGeo(w, h, d, ridge), c, x, yb, z, 0, ry, 0); }
  torus(r, t, arc, c, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.TorusGeometry(r, t, 4, 10, arc), c, x, y, z, rx, ry, rz); }
  geo() { return this.parts.length ? mergeParts(this.parts) : null; }
}

// ------------------------------------------------------------------
//  UNIT MODELS  (origin at feet, facing +Z)
// ------------------------------------------------------------------
const C = { skin: 0xe2b48c, pants: 0x4e3d2c, leather: 0x6b4a2b, iron: 0xa9b1ba, dark: 0x4d535a, wood: 0x8a5f34, horse: 0x7a5232, horse2: 0x3b2a1e, straw: 0xd6b765, white: 0xffffff, cloth: 0xe8e2d2, hood: 0x5f6b3c };
// --- humanoid builder: returns nothing, registers animated limbs (legs, left arm) ---
function human(b, t, limb, o = {}) {
  const skin = o.skin || C.skin, pants = o.pants || C.pants, boots = o.boots || 0x3a2a1c;
  for (const s of [-1, 1]) {
    const L = limb([s * 0.058, 0.28, 0], s > 0 ? Math.PI : 0, 0.6);
    L.box(0.085, 0.2, 0.095, pants, s * 0.058, 0.08, 0);
    L.box(0.096, 0.085, 0.14, boots, s * 0.058, 0, 0.018);
    if (o.greaves) L.box(0.09, 0.1, 0.1, o.greaves, s * 0.058, 0.1, 0.004);
  }
  b.box(0.22, 0.07, 0.14, pants, 0, 0.25, 0);
  if (o.torso) b.box(0.24, 0.27, 0.15, o.torso, 0, 0.3, 0); else t.box(0.24, 0.27, 0.15, C.white, 0, 0.3, 0);
  if (o.tabard) { t.box(0.2, 0.3, 0.02, C.white, 0, 0.26, 0.078); t.box(0.2, 0.3, 0.02, C.white, 0, 0.26, -0.078); }
  else t.box(0.262, 0.075, 0.168, C.white, 0, 0.245, 0);
  b.box(0.254, 0.036, 0.164, C.leather, 0, 0.33, 0); b.box(0.042, 0.042, 0.02, 0xd8b04a, 0, 0.327, 0.083);
  b.cyl(0.036, 0.042, 0.05, skin, 0, 0.565, 0, 6);
  b.sph(0.098, skin, 0, 0.665, 0, 1, 1.06, 1, 12, 10);
  b.box(0.022, 0.026, 0.01, 0x1d1712, -0.036, 0.676, 0.092); b.box(0.022, 0.026, 0.01, 0x1d1712, 0.036, 0.676, 0.092);
  b.box(0.03, 0.008, 0.008, 0x6b4a33, -0.036, 0.7, 0.093); b.box(0.03, 0.008, 0.008, 0x6b4a33, 0.036, 0.7, 0.093);
  b.box(0.02, 0.032, 0.03, 0xcf9d78, 0, 0.646, 0.099);
  b.box(0.04, 0.008, 0.008, 0x8a4a3a, 0, 0.618, 0.094);
  if (o.beard) b.box(0.12, 0.06, 0.05, o.hair || 0x5a3a22, 0, 0.6, 0.075);
  if (o.hair !== false) b.sph(0.103, o.hair || 0x5a3a22, 0, 0.692, -0.02, 1, 0.82, 1, 12, 8);
  if (o.pads) for (const s of [-1, 1]) b.sph(0.068, o.pads, s * 0.158, 0.54, 0, 1, 0.72, 1, 8, 6);
  const A = limb([-0.165, 0.53, 0], Math.PI, 0.5);
  A.box(0.078, 0.135, 0.088, o.sleeve || 0xd8cfb8, -0.165, 0.405, 0);
  A.box(0.066, 0.12, 0.074, o.arm || skin, -0.165, 0.29, 0);
  A.sph(0.037, skin, -0.165, 0.275, 0.005, 1, 1, 1, 6, 5);
}
function rightArm(w, o = {}) {
  w.box(0.078, 0.135, 0.088, o.sleeve || 0xd8cfb8, 0.165, 0.405, 0);
  w.box(0.066, 0.12, 0.074, o.arm || C.skin, 0.165, 0.29, 0);
  w.sph(0.037, C.skin, 0.165, 0.275, 0.005, 1, 1, 1, 6, 5);
}
function helmet(b, col, plume) {
  b.sph(0.108, col, 0, 0.69, -0.005, 1, 0.78, 1.02, 12, 8);
  b.box(0.23, 0.025, 0.23, col, 0, 0.665, 0);
  b.box(0.02, 0.07, 0.02, col, 0, 0.64, 0.105);
  if (plume) b.boxc(0.025, 0.09, 0.16, plume, 0, 0.8, -0.02);
}
function horse(b, limb, col, mane, hoof = 0x2a1d14) {
  b.boxc(0.22, 0.22, 0.5, col, 0, 0.52, 0);
  b.sph(0.125, col, 0, 0.52, 0.22, 1, 1, 1.15, 10, 8); b.sph(0.125, col, 0, 0.53, -0.22, 1, 1, 1.15, 10, 8);
  b.boxc(0.11, 0.3, 0.13, col, 0, 0.7, 0.31, -0.6, 0, 0);
  b.boxc(0.1, 0.11, 0.24, col, 0, 0.83, 0.43, 0.25, 0, 0);
  b.boxc(0.085, 0.085, 0.08, hoof, 0, 0.79, 0.54, 0.25, 0, 0);
  for (const s of [-1, 1]) { b.boxc(0.025, 0.07, 0.025, col, s * 0.035, 0.92, 0.37); b.box(0.012, 0.018, 0.018, 0x111111, s * 0.051, 0.83, 0.44); }
  b.boxc(0.035, 0.27, 0.12, mane, 0, 0.77, 0.28, -0.6, 0, 0);
  b.boxc(0.05, 0.28, 0.06, mane, 0, 0.45, -0.37, 0.45, 0, 0);
  b.boxc(0.105, 0.02, 0.02, 0x2a1d14, 0, 0.84, 0.5, 0.25, 0, 0); b.boxc(0.105, 0.11, 0.015, 0x2a1d14, 0, 0.82, 0.38, 0.25, 0, 0); for (const sx of [-1, 1]) b.boxc(0.01, 0.01, 0.3, 0x2a1d14, sx * 0.055, 0.78, 0.36, -0.35, 0, 0);
  b.boxc(0.24, 0.06, 0.24, 0x5a3820, 0, 0.64, 0); b.boxc(0.2, 0.08, 0.04, 0x5a3820, 0, 0.68, -0.11); for (const sx of [-1, 1]) b.boxc(0.01, 0.16, 0.03, 0x3a2a1c, sx * 0.13, 0.55, 0.03);
  for (const [x, z, ph] of [[-0.075, 0.2, 0], [0.075, 0.2, Math.PI], [-0.075, -0.2, Math.PI], [0.075, -0.2, 0]]) {
    const L = limb([x, 0.42, z], ph, 0.6);
    L.box(0.065, 0.32, 0.075, col, x, 0.08, z); L.box(0.075, 0.085, 0.09, hoof, x, 0, z + 0.005);
  }
}
function rider(b, t, w, o) {
  for (const s of [-1, 1]) { b.boxc(0.075, 0.24, 0.085, o.legs, s * 0.14, 0.62, 0.05); b.boxc(0.085, 0.08, 0.13, 0x3a2a1c, s * 0.14, 0.5, 0.08); }
  b.box(0.2, 0.06, 0.13, o.legs, 0, 0.64, 0);
  if (o.torso) b.box(0.22, 0.25, 0.14, o.torso, 0, 0.68, 0); else t.box(0.22, 0.25, 0.14, C.white, 0, 0.68, 0);
  if (o.tabard) t.box(0.18, 0.26, 0.02, C.white, 0, 0.66, 0.075);
  b.cyl(0.034, 0.04, 0.05, C.skin, 0, 0.93, 0, 6);
  b.sph(0.092, C.skin, 0, 1.02, 0, 1, 1.06, 1, 12, 10);
  b.box(0.02, 0.024, 0.01, 0x1d1712, -0.034, 1.03, 0.087); b.box(0.02, 0.024, 0.01, 0x1d1712, 0.034, 1.03, 0.087);
  b.box(0.072, 0.21, 0.078, o.sleeve, -0.15, 0.72, 0.04); b.sph(0.035, C.skin, -0.15, 0.72, 0.06);
  w.box(0.072, 0.21, 0.078, o.sleeve, 0.15, 0.72, 0.04); w.sph(0.035, C.skin, 0.15, 0.72, 0.06);
  if (o.pads) for (const s of [-1, 1]) b.sph(0.062, o.pads, s * 0.145, 0.9, 0, 1, 0.72, 1, 8, 6);
}
function buildUnitModels() {
  const M = {};
  const mk = (type, f) => {
    const P = { base: new MB(), team: new MB(), weapon: new MB(), limbs: [], carry: {} };
    const limb = (pivot, phase, amp, kind = 'swing') => { const b = new MB(); P.limbs.push({ b, pivot, phase, amp, kind }); return b; };
    const carry = res => (P.carry[res] = new MB());
    const meta = f(P.base, P.team, P.weapon, limb, carry) || {};
    const cg = {}; for (const k in P.carry) cg[k] = P.carry[k].geo();
    M[type] = Object.assign({ base: P.base.geo(), team: P.team.geo(), weapon: P.weapon.geo(),
      limbs: P.limbs.map(l => ({ geo: l.b.geo(), pivot: l.pivot, phase: l.phase, amp: l.amp, kind: l.kind })), carry: cg,
      pivot: [0.165, 0.53, 0], anim: 'swing', scale: 1.22, armSwing: true }, meta);
  };
  mk('villager', (b, t, w, limb, carry) => {
    human(b, t, limb, { hair: 0x6b4426, sleeve: 0xd9cbb0 });
    b.cyl(0.17, 0.17, 0.016, C.straw, 0, 0.705, 0, 14); b.cone(0.11, 0.1, C.straw, 0, 0.715, 0, 12); b.cyl(0.112, 0.112, 0.02, 0x9a6a3a, 0, 0.72, 0, 12);
    rightArm(w, { sleeve: 0xd9cbb0 });
    w.cylc(0.016, 0.016, 0.34, C.wood, 0.165, 0.27, 0.13, Math.PI / 2, 0, 0, 6);
    w.boxc(0.025, 0.11, 0.075, C.iron, 0.165, 0.3, 0.28); w.boxc(0.03, 0.05, 0.03, C.iron, 0.165, 0.27, 0.25);
    const W = carry('wood'); for (let i = 0; i < 3; i++) W.cylc(0.038, 0.038, 0.36, i === 1 ? 0x9a6a3a : 0x7f5530, (i - 1) * 0.02, 0.47 + i * 0.05, -0.14 - (i % 2) * 0.02, 0, 0.3, Math.PI / 2, 7);
    const F = carry('food'); F.cyl(0.095, 0.075, 0.12, 0xa8783a, 0, 0.36, -0.16, 10); F.cyl(0.1, 0.1, 0.02, 0x8a5a2a, 0, 0.47, -0.16, 10); for (let i = 0; i < 5; i++) F.sph(0.035, i % 2 ? 0xd8453a : 0xe86a3a, Math.cos(i * 1.3) * 0.05, 0.5, -0.16 + Math.sin(i * 1.3) * 0.05, 1, 1, 1, 6, 5);
    const G = carry('gold'); G.sph(0.095, 0x9a7a4a, 0, 0.44, -0.16, 1, 1.15, 0.9, 8, 6); G.cyl(0.03, 0.05, 0.05, 0x6b4a2a, 0, 0.54, -0.16, 6); for (let i = 0; i < 3; i++) G.dod(0.03, 0xf4c430, -0.03 + i * 0.03, 0.56, -0.15);
    const S = carry('stone'); S.dod(0.085, 0xa0a0a6, 0, 0.47, -0.16, 1.2, 0.9, 1); S.dod(0.05, 0x8a8a90, 0.05, 0.53, -0.15);
  });
  mk('spearman', (b, t, w, limb) => {
    human(b, t, limb, { sleeve: 0xb9ab8e, pads: C.leather, hair: 0x3a2a1a });
    helmet(b, C.iron);
    t.cylc(0.13, 0.13, 0.03, C.white, -0.22, 0.4, 0.06, Math.PI / 2, 0, 0, 14); b.cylc(0.04, 0.04, 0.035, C.iron, -0.22, 0.4, 0.08, Math.PI / 2, 0, 0, 8);
    rightArm(w, { sleeve: 0xb9ab8e });
    w.cylc(0.014, 0.014, 1.15, C.wood, 0.165, 0.5, 0.05, 0.22, 0, 0, 6);
    w.add(new THREE.ConeGeometry(0.035, 0.14, 6), 0xdfe6ee, 0.165, 1.08, 0.18, 0.22, 0, 0);
    return { anim: 'thrust' };
  });
  mk('swordsman', (b, t, w, limb) => {
    human(b, t, limb, { torso: C.iron, tabard: true, sleeve: C.iron, arm: 0x8a929b, pants: C.dark, greaves: C.iron, pads: 0x8a929b, hair: 0x2a1f16, beard: true });
    helmet(b, 0xbac3cc);
    t.boxc(0.24, 0.4, 0.02, C.white, 0, 0.36, -0.095, 0.14, 0, 0); b.sph(0.03, 0xd4ad4c, -0.1, 0.55, -0.07); b.sph(0.03, 0xd4ad4c, 0.1, 0.55, -0.07);
    t.boxc(0.04, 0.3, 0.22, C.white, -0.23, 0.4, 0.05); b.boxc(0.045, 0.06, 0.06, 0xd4ad4c, -0.24, 0.42, 0.08);
    rightArm(w, { sleeve: C.iron, arm: 0x8a929b });
    w.boxc(0.03, 0.4, 0.012, 0xe6edf4, 0.165, 0.44, 0.16, 0.9, 0, 0);
    w.boxc(0.12, 0.022, 0.035, 0xd4ad4c, 0.165, 0.3, 0.05, 0.9, 0, 0);
  });
  mk('archer', (b, t, w, limb) => {
    human(b, t, limb, { sleeve: 0x6b7a44, hair: 0x7a4a2a });
    b.sph(0.11, C.hood, 0, 0.69, -0.015, 1, 0.9, 1.02, 10, 8); b.cone(0.07, 0.14, C.hood, 0, 0.66, -0.1, 6);
    b.cylc(0.045, 0.045, 0.34, C.leather, 0.07, 0.44, -0.13, 0.3, 0, 0, 8);
    for (let i = 0; i < 3; i++) b.boxc(0.02, 0.06, 0.02, 0xf0f0f0, 0.05 + i * 0.02, 0.63, -0.08);
    rightArm(w, { sleeve: 0x6b7a44 });
    // bow held upright in front of the hand: curved limbs + string
    for (let k = 0; k < 9; k++) { const a = -1.05 + k * (2.1 / 8); w.boxc(0.02, 0.075, 0.022, k === 4 ? 0x4a2f18 : 0x7a4f28, 0.165, 0.3 + Math.sin(a) * 0.25, 0.1 + Math.cos(a) * 0.09, -a, 0, 0); }
    w.boxc(0.004, 0.43, 0.004, 0xeeeeee, 0.165, 0.3, 0.1 + Math.cos(1.05) * 0.09);
    return { anim: 'bow' };
  });
  mk('crossbow', (b, t, w, limb) => {
    human(b, t, limb, { sleeve: 0x8a7a5a, pants: C.dark, pads: C.leather, hair: 0x2a1f16 });
    b.cyl(0.105, 0.105, 0.06, C.iron, 0, 0.7, 0, 12); b.cyl(0.17, 0.17, 0.015, C.iron, 0, 0.69, 0, 14);
    b.boxc(0.06, 0.1, 0.05, C.leather, 0.12, 0.35, -0.08);
    rightArm(w, { sleeve: 0x8a7a5a });
    w.boxc(0.05, 0.05, 0.4, C.wood, 0.11, 0.42, 0.17); w.boxc(0.38, 0.025, 0.03, C.dark, 0.11, 0.43, 0.33);
    return { anim: 'bow' };
  });
  mk('scout', (b, t, w, limb) => {
    horse(b, limb, C.horse, C.horse2);
    t.boxc(0.27, 0.05, 0.32, C.white, 0, 0.64, 0);
    rider(b, t, w, { legs: C.pants, sleeve: 0xb9ab8e, pads: C.leather });
    b.sph(0.1, C.iron, 0, 1.06, -0.005, 1, 0.75, 1, 10, 8);
    w.boxc(0.024, 0.36, 0.012, 0xe6edf4, 0.15, 0.85, 0.22, 0.9, 0, 0);
    return { pivot: [0.15, 0.82, 0], cav: true, scale: 1.15 };
  });
  mk('knight', (b, t, w, limb) => {
    horse(b, limb, C.horse2, 0x1e1712);
    t.boxc(0.28, 0.2, 0.62, C.white, 0, 0.5, 0); t.boxc(0.13, 0.2, 0.14, C.white, 0, 0.72, 0.33, -0.6, 0, 0);
    rider(b, t, w, { legs: C.iron, torso: C.iron, tabard: true, sleeve: C.iron, pads: 0xbac3cc });
    b.cyl(0.095, 0.095, 0.17, 0xbac3cc, 0, 0.98, 0, 12); b.box(0.17, 0.018, 0.02, C.dark, 0, 1.06, 0.09);
    t.boxc(0.025, 0.11, 0.17, C.white, 0, 1.2, -0.02); t.boxc(0.22, 0.36, 0.02, C.white, 0, 0.74, -0.1, 0.25, 0, 0);
    t.boxc(0.035, 0.26, 0.2, C.white, -0.2, 0.76, 0.07);
    w.cylc(0.02, 0.035, 1.2, 0x8a5f34, 0.16, 0.76, 0.42, Math.PI / 2 - 0.12, 0, 0, 7);
    w.add(new THREE.ConeGeometry(0.03, 0.12, 6), 0xe6edf4, 0.16, 0.69, 1.03, Math.PI / 2 - 0.12, 0, 0);
    return { pivot: [0.15, 0.82, 0], anim: 'thrust', cav: true, scale: 1.15 };
  });
  mk('ram', (b, t, w, limb) => {
    b.box(0.5, 0.08, 1.0, 0x5a3e24, 0, 0.16, 0);
    for (const z of [0.32, -0.32]) { const L = limb([0, 0.13, z], 0, 1, 'spin'); for (const x of [-0.3, 0.3]) { L.cylc(0.13, 0.13, 0.06, 0x3a2a1a, x, 0.13, z, 0, 0, Math.PI / 2, 12); L.boxc(0.065, 0.22, 0.03, 0x6b4a2a, x * 1.08, 0.13, z); } }
    for (const [x, z] of [[-0.24, 0.42], [0.24, 0.42], [-0.24, -0.42], [0.24, -0.42]]) b.box(0.05, 0.4, 0.05, C.wood, x, 0.2, z);
    b.roof(0.7, 1.14, 0.4, 0x7a5232, 0, 0.58, 0, 0.0, 0);
    for (let i = 0; i < 4; i++) b.box(0.72, 0.03, 0.05, 0x5a3e24, 0, 0.6 + i * 0.07, -0.45 + i * 0.3);
    b.box(0.68, 0.04, 1.12, 0x5a3e24, 0, 0.56, 0);
    t.boxc(0.02, 0.2, 0.26, C.white, 0, 1.08, -0.3); b.cylc(0.012, 0.012, 0.4, 0x5c3f24, 0, 0.92, -0.42);
    w.cylc(0.075, 0.075, 1.2, 0x6a4a2a, 0, 0.36, 0.12, Math.PI / 2, 0, 0, 8);
    w.cylc(0.1, 0.075, 0.16, C.dark, 0, 0.36, 0.78, Math.PI / 2, 0, 0, 8);
    return { anim: 'ram', pivot: [0, 0, 0], scale: 1.1, armSwing: false };
  });
  mk('catapult', (b, t, w, limb) => {
    b.box(0.5, 0.08, 0.9, 0x5a3e24, 0, 0.16, 0);
    for (const z of [0.3, -0.3]) { const L = limb([0, 0.13, z], 0, 1, 'spin'); for (const x of [-0.3, 0.3]) { L.cylc(0.13, 0.13, 0.06, 0x3a2a1a, x, 0.13, z, 0, 0, Math.PI / 2, 12); L.boxc(0.065, 0.22, 0.03, 0x6b4a2a, x * 1.08, 0.13, z); } }
    b.box(0.06, 0.42, 0.06, C.wood, -0.18, 0.2, 0.1); b.box(0.06, 0.42, 0.06, C.wood, 0.18, 0.2, 0.1);
    b.boxc(0.44, 0.06, 0.06, C.wood, 0, 0.6, 0.1);
    b.boxc(0.3, 0.2, 0.2, C.dark, 0, 0.32, -0.25); b.sph(0.06, 0x8a8a8a, 0.1, 0.27, 0.3);
    t.boxc(0.02, 0.16, 0.22, C.white, 0.2, 0.78, -0.38); b.cylc(0.01, 0.01, 0.55, 0x5c3f24, 0.2, 0.52, -0.38);
    w.boxc(0.06, 0.06, 0.85, C.wood, 0, 0.36, -0.05, 0.12, 0, 0);
    w.sph(0.1, 0x5a3e24, 0, 0.42, -0.47, 1, 0.6, 1); w.dod(0.07, 0x8a8478, 0, 0.47, -0.47);
    return { anim: 'cata', pivot: [0, 0.34, 0.25], scale: 1.1, armSwing: false };
  });
  mk('deer', (b, t, w, limb) => {
    const col = 0x9a6a40;
    b.boxc(0.15, 0.17, 0.4, col, 0, 0.42, 0); b.sph(0.085, col, 0, 0.42, 0.17, 1, 1, 1.1, 8, 6); b.sph(0.085, col, 0, 0.43, -0.17, 1, 1, 1.1, 8, 6);
    b.boxc(0.12, 0.08, 0.3, 0xe9dcc4, 0, 0.35, 0);
    for (const [x, z, ph] of [[-0.05, 0.15, 0], [0.05, 0.15, Math.PI], [-0.05, -0.15, Math.PI], [0.05, -0.15, 0]]) { const L = limb([x, 0.36, z], ph, 0.7); L.box(0.04, 0.34, 0.045, 0x7a5232, x, 0.0, z); }
    b.boxc(0.07, 0.22, 0.08, col, 0, 0.58, 0.22, -0.5, 0, 0);
    b.boxc(0.075, 0.085, 0.17, col, 0, 0.68, 0.29); b.boxc(0.05, 0.05, 0.05, 0x2a1d14, 0, 0.665, 0.38);
    for (const s of [-1, 1]) { b.boxc(0.02, 0.06, 0.035, col, s * 0.05, 0.74, 0.24, 0, 0, s * 0.6); b.box(0.012, 0.016, 0.012, 0x111111, s * 0.039, 0.69, 0.33); }
    b.boxc(0.05, 0.06, 0.04, 0xf2ebdc, 0, 0.48, -0.22);
    for (const s of [-1, 1]) { b.boxc(0.015, 0.18, 0.015, 0x5a4530, s * 0.04, 0.82, 0.25, 0, 0, s * 0.35); b.boxc(0.015, 0.09, 0.015, 0x5a4530, s * 0.085, 0.88, 0.28, 0.5, 0, s * 0.7); b.boxc(0.013, 0.07, 0.013, 0x5a4530, s * 0.07, 0.9, 0.21, -0.5, 0, s * 0.3); }
    return { anim: 'none', scale: 1.1, armSwing: false };
  });
  return M;
}

// ------------------------------------------------------------------
//  BUILDING MODELS (per type and age)
// ------------------------------------------------------------------
const PAL = [
  { wall: 0xb08758, wall2: 0x957049, roof: 0xd1ab62, roof2: 0xa98545, base: 0x8d8577, beam: 0x5c3f24, trim: 0x6b4a2b, stone: 0x9a958a, shutter: 0x6b8a4a },
  { wall: 0xe6dcc2, wall2: 0xc4b89c, roof: 0xb4583a, roof2: 0x8e4128, base: 0x958e80, beam: 0x4f3520, trim: 0x5c3f24, stone: 0xa39d90, shutter: 0x3f6a8a },
  { wall: 0xc4bdae, wall2: 0xaaa394, roof: 0x4b5a6a, roof2: 0x36414e, base: 0x8a8478, beam: 0x3e3a36, trim: 0xd4ad4c, stone: 0xb3ad9f, shutter: 0x7a2f2a },
];
const BM = {};
function flagPole(b, t, x, z, yb, h, w = 0.32) {
  b.cyl(0.025, 0.025, h, 0x5c3f24, x, yb, z, 5);
  t.boxc(0.02, w * 0.65, w, C.white, x, yb + h - w * 0.4, z + w / 2 + 0.02);
}
function foundation(b, s, P, h = 0.55) {
  b.box(s - 0.08, h, s - 0.08, P.base, 0, -h + 0.18, 0);
  // irregular stone blocks along the top edge
  const e = (s - 0.08) / 2, n = Math.max(3, Math.round(s * 2.2));
  for (let k = 0; k < n; k++) {
    const t = -e + (k + 0.5) * (2 * e / n), w = 2 * e / n - 0.03, sh = [0x9d978b, 0x8c867a, 0xaaa496, 0x7f7a6f][(k * 7 + s) % 4];
    b.box(w, 0.13, 0.06, sh, t, 0.06, e - 0.01); b.box(w, 0.13, 0.06, sh, t, 0.06, -e + 0.01);
    b.box(0.06, 0.13, w, sh, e - 0.01, 0.06, t); b.box(0.06, 0.13, w, sh, -e + 0.01, 0.06, t);
  }
}
function win(b, x, y, z, rotY, P) {
  // framed window with shutters and sill (faces +z before rotation)
  const add = (w, h, d, c, ox, oy, oz) => { const cx = Math.cos(rotY), sx = Math.sin(rotY); b.add(new THREE.BoxGeometry(w, h, d), c, x + ox * cx + oz * sx, y + oy, z - ox * sx + oz * cx, 0, rotY, 0); };
  add(0.15, 0.17, 0.02, 0x2a3440, 0, 0, 0.012);
  add(0.19, 0.025, 0.03, 0xe8dcc0, 0, 0.095, 0.015); add(0.2, 0.03, 0.06, 0xe8dcc0, 0, -0.1, 0.025);
  add(0.025, 0.17, 0.03, 0xe8dcc0, -0.085, 0, 0.015); add(0.025, 0.17, 0.03, 0xe8dcc0, 0.085, 0, 0.015);
  add(0.006, 0.17, 0.025, 0xe8dcc0, 0, 0, 0.016);
  add(0.075, 0.18, 0.015, P.shutter, -0.135, 0, 0.02); add(0.075, 0.18, 0.015, P.shutter, 0.135, 0, 0.02);
}
function windows(b, w, h, d, yb, n = 2, c, P = PAL[0]) {
  for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * (w / (n + 0.5)); win(b, x, yb + h * 0.55, d / 2, 0, P); win(b, -x, yb + h * 0.55, -d / 2, Math.PI, P); }
}
function door(b, x, z, w = 0.32, h = 0.5, P = PAL[0]) {
  b.box(w + 0.08, h + 0.05, 0.03, P.beam, x, 0.15, z + 0.005);
  b.box(w, h, 0.04, 0x5a3c22, x, 0.15, z + 0.012);
  for (let i = 1; i < 3; i++) b.box(0.012, h, 0.045, 0x3e2a18, x - w / 2 + i * w / 3, 0.15, z + 0.014);
  b.sph(0.018, 0xd4ad4c, x + w * 0.32, 0.15 + h * 0.5, z + 0.04, 1, 1, 1, 5, 4);
  b.box(w + 0.16, 0.04, 0.18, P.base, x, 0.13, z + 0.09);
}
function barrel(b, x, z, y = 0.15) { b.cyl(0.08, 0.08, 0.2, 0x8a5a30, x, y, z, 9); b.cyl(0.083, 0.083, 0.02, 0x3a3a3a, x, y + 0.04, z, 9); b.cyl(0.083, 0.083, 0.02, 0x3a3a3a, x, y + 0.14, z, 9); }
function crate(b, x, z, y = 0.15, s = 0.16) { b.box(s, s, s, 0xa0763e, x, y, z); b.box(s + 0.01, 0.02, s + 0.01, 0x6b4a2b, x, y + s - 0.02, z); b.box(s + 0.01, 0.02, s + 0.01, 0x6b4a2b, x, y, z); }
function hay(b, x, z, y = 0.15) { b.cylc(0.11, 0.11, 0.22, 0xd8bf5a, x, y + 0.11, z, 0, 0, Math.PI / 2, 9); }
function hall(b, P, a, x, z, w, d, h, rh, ridge, ry = 0) {
  b.box(w, h, d, P.wall, x, 0.15, z, ry);
  const corner = a === 2 ? P.stone : P.beam;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (a === 2) { for (let k = 0; k < Math.floor(h / 0.16); k++) b.box(0.1 + (k % 2) * 0.04, 0.13, 0.1 + ((k + 1) % 2) * 0.04, k % 2 ? 0xa8a294 : 0x958f82, x + sx * (w / 2 - 0.02), 0.16 + k * 0.16, z + sz * (d / 2 - 0.02)); }
    else b.box(0.075, h, 0.075, corner, x + sx * (w / 2 - 0.02), 0.15, z + sz * (d / 2 - 0.02));
  }
  if (a === 0) { const n = Math.max(3, Math.round(w / 0.18)); for (let k = 1; k < n; k++) { const px = x - w / 2 + k * w / n; b.box(0.012, h, 0.012, 0x7a5a38, px, 0.15, z + d / 2 + 0.003); b.box(0.012, h, 0.012, 0x7a5a38, px, 0.15, z - d / 2 - 0.003); } }
  if (a === 1) {
    b.box(w + 0.02, 0.06, d + 0.02, P.beam, x, 0.15 + h * 0.5, z); b.box(w + 0.02, 0.06, d + 0.02, P.beam, x, 0.12 + h, z);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.045, h * 0.62, 0.02), P.beam, x + sx * w * 0.3, 0.15 + h * 0.75, z + sz * (d / 2 + 0.005), 0, 0, sx * 0.75);
  }
  if (a === 2) { b.box(w + 0.06, 0.25, d + 0.06, P.stone, x, 0.15, z); b.box(w + 0.04, 0.05, d + 0.04, 0xc9c2b2, x, 0.1 + h, z); }
  const ry2 = 0.15 + h;
  b.box(w * 1.2, 0.04, d * 1.2, P.beam, x, ry2 - 0.02, z, ry);
  b.roof(w * 1.24, d * 1.24, rh * 0.22, P.roof2, x, ry2, z, ridge * 1.05 + w * 0.0, ry);
  b.roof(w * 1.18, d * 1.18, rh, P.roof, x, ry2 + 0.01, z, ridge, ry);
  b.roof(w * 0.86, d * 0.86, rh * 0.74, P.roof2, x, ry2 + rh * 0.26 + 0.012, z, ridge, ry);
  if (ridge > 0) b.boxc(ridge + 0.08, 0.05, 0.07, P.roof2, x, ry2 + rh + 0.015, z, 0, ry, 0);
  return ry2;
}
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += c; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
// a downloaded model (poly.pizza) standing on a stone foundation, plus a team banner
function glbBuildingModel(type, age, variant = 0, faction) {
  const look = faction && typeof REALM_LOOK !== 'undefined' && REALM_LOOK[faction];
  const map = (look && look.glb[type]) || (typeof BUILDING_GLB !== 'undefined' && BUILDING_GLB[type]); if (!map) return null;
  let ent = map[age] !== undefined ? map[age] : map.all;
  if (Array.isArray(ent)) ent = ent[variant % ent.length];
  if (!ent || typeof CHARS === 'undefined') return null;
  const spec = typeof ent === 'string' ? { parts: [[ent, 0, 0, 0, 1]] } : ent;
  if (!spec.parts.every(p => CHARS[p[0]])) return null;
  const s = BUILDINGS[type].size, b = new MB(), t = new MB(), geos = [];
  const lift = spec.bare ? (spec.lift || 0) : 0.17;
  if (!spec.bare) {
    foundation(b, s, PAL[age], 0.45);
    const e = s / 2 - 0.12;
    flagPole(b, t, e, e, 0.1, 1.4 + s * 0.35, 0.3);
    if (s >= 3) flagPole(b, t, -e, e, 0.1, 1.4 + s * 0.35, 0.3);
    geos.push(b.geo());
  }
  for (const [name, x, z, ry, sc] of spec.parts) { const g = CHARS[name].idle.clone(); if (sc && sc !== 1) g.scale(sc, sc, sc); if (ry) g.rotateY(ry); g.translate(x, lift, z);
    if (look && g.attributes.color) { const a = g.attributes.color.array, mx = a instanceof Float32Array ? 1 : 255, tn = look.tint; for (let i = 0; i < a.length; i++) a[i] = Math.min(mx, a[i] * tn[i % 3]); }
    geos.push(g); }
  return { base: mergeGeos(geos), team: spec.bare ? null : t.geo() };
}
function buildingModel(type, age, variant = 0, faction) {
  const key = type + age + 'v' + variant + (faction || ''); if (BM[key]) return BM[key];
  const gm = glbBuildingModel(type, age, variant, faction); if (gm) return (BM[key] = gm);
  const b = new MB(), t = new MB(), P = PAL[age], a = age;
  const s = BUILDINGS[type].size;
  switch (type) {
    case 'towncenter': {
      foundation(b, s, P, 0.7); b.box(3.9, 0.12, 3.9, P.stone, 0, 0.12, 0);
      const h = 1.0 + a * 0.25;
      const top = hall(b, P, a, 0, 0, 2.7, 2.7, h, 0.9 + a * 0.1, 0);
      door(b, -0.2, 1.36, 0.5, 0.62, P); windows(b, 2.7, h, 2.7, 0.15, 3, 0, P); win(b, 1.36, 0.15 + h * 0.55, -0.6, Math.PI / 2, P); win(b, 1.36, 0.15 + h * 0.55, 0.6, Math.PI / 2, P); win(b, -1.36, 0.15 + h * 0.55, 0.6, -Math.PI / 2, P); win(b, -1.36, 0.15 + h * 0.55, -0.6, -Math.PI / 2, P);
      barrel(b, 0.75, 1.6); barrel(b, 0.95, 1.55); crate(b, -1.1, 1.62); crate(b, -1.25, 1.45, 0.15, 0.13); b.box(0.3, 0.25, 0.3, 0x6b6b70, 1.6, 0.15, 0.6); b.cyl(0.13, 0.13, 0.02, 0x3f86b8, 1.6, 0.41, 0.6, 10);
      b.box(1.1, 0.9 + a * 0.4, 1.1, P.wall2, 0, top - 0.2, 0);
      b.roof(1.45, 1.45, 0.8, P.roof2, 0, top + 0.7 + a * 0.4, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const th = 1.3 + a * 0.45;
        if (a === 0) b.cyl(0.13, 0.15, th, P.beam, sx * 1.62, 0.15, sz * 1.62, 6);
        else b.cyl(0.26, 0.3, th, P.stone, sx * 1.6, 0.15, sz * 1.6, 8);
        b.cone(a === 0 ? 0.22 : 0.38, 0.45, P.roof, sx * 1.6, 0.15 + th, sz * 1.6, 8);
      }
      if (a === 2) b.cone(0.1, 0.5, P.trim, 0, top + 1.5 + a * 0.4, 0, 6);
      t.box(2.76, 0.12, 2.76, C.white, 0, 0.15 + h * 0.78, 0);
      flagPole(b, t, -1.0, 1.75, 0.1, 1.5 + a * 0.3); flagPole(b, t, 1.0, 1.75, 0.1, 1.5 + a * 0.3);
      break;
    }
    case 'house': {
      foundation(b, s, P, 0.45);
      const h = 0.7 + a * 0.15;
      const top = hall(b, P, a, 0, 0, 1.35, 1.2, h, 0.7, 0.55);
      door(b, 0.27, 0.6, 0.28, 0.44, P); win(b, -0.3, 0.15 + h * 0.55, 0.6, 0, P); win(b, 0.68, 0.15 + h * 0.55, 0, Math.PI / 2, P); win(b, -0.68, 0.15 + h * 0.55, 0, -Math.PI / 2, P); win(b, 0, 0.15 + h * 0.55, -0.6, Math.PI, P);
      b.box(0.24, 0.05, 0.07, 0x6b4a2b, -0.3, 0.15 + h * 0.55 - 0.15, 0.64); for (let k = 0; k < 4; k++) b.sph(0.03, [0xe45a8a, 0xf6d84a, 0xffffff, 0xe45a8a][k], -0.39 + k * 0.06, 0.15 + h * 0.55 - 0.08, 0.645, 1, 1, 1, 5, 4);
      barrel(b, 0.75, 0.75); if (a > 0) crate(b, -0.78, 0.72);
      b.box(0.18, 0.55, 0.18, P.stone, -0.38, top - 0.1, -0.25); b.box(0.22, 0.05, 0.22, 0x7a7468, -0.38, top + 0.45, -0.25);
      t.box(0.32, 0.22, 0.03, C.white, -0.32, 0.4, 0.61);
      break;
    }
    case 'lumbercamp': case 'miningcamp': {
      foundation(b, s, P, 0.4);
      const ph = 0.95 + a * 0.15;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, ph, 0.08, P.beam, sx * 0.62, 0.15, sz * 0.5);
      b.box(1.3, 0.5 + a * 0.1, 0.06, P.wall, 0, 0.15, -0.5);
      b.roof(1.6, 1.35, 0.45, P.roof, 0, 0.15 + ph, 0, 0.5);
      if (type === 'lumbercamp') {
        for (let i = 0; i < 3; i++) b.cylc(0.11, 0.11, 1.1, 0x7a5232, 0, 0.27 + i * 0.0, 0.2 + i * 0.0 - 0.1 + i * 0.22, 0, 0, Math.PI / 2, 7);
        b.cylc(0.11, 0.11, 1.1, 0x7a5232, 0, 0.46, 0.21, 0, 0, Math.PI / 2, 7); b.cylc(0.11, 0.11, 1.1, 0x7a5232, 0, 0.46, 0.43, 0, 0, Math.PI / 2, 7);
        b.cyl(0.18, 0.2, 0.25, 0x8a6a42, 0.7, 0.15, 0.75, 8); b.boxc(0.03, 0.25, 0.03, C.wood, 0.7, 0.52, 0.75, 0, 0, 0.4);
      } else {
        b.dod(0.25, 0xa8a8a8, -0.3, 0.35, 0.35); b.dod(0.18, 0x8e8e8e, -0.05, 0.3, 0.55); b.dod(0.15, 0xe2b82a, 0.3, 0.27, 0.4);
        b.box(0.45, 0.2, 0.3, C.wood, 0.55, 0.3, -0.05); for (const z of [-0.18, 0.08]) b.cylc(0.1, 0.1, 0.05, 0x3a2a1a, 0.55, 0.28, z, 0, 0, Math.PI / 2, 8);
      }
      flagPole(b, t, -0.75, 0.75, 0.1, 1.3, 0.26);
      break;
    }
    case 'mill': {
      foundation(b, s, P, 0.45);
      const h = 1.3 + a * 0.2;
      b.cyl(0.55, 0.65, h, P.wall, 0, 0.15, 0, 10);
      if (a === 2) b.cyl(0.67, 0.67, 0.25, P.stone, 0, 0.15, 0, 10);
      b.cone(0.75, 0.65, P.roof, 0, 0.15 + h, 0, 10);
      door(b, 0, 0.62, 0.28, 0.44, P); barrel(b, 0.75, 0.7); hay(b, -0.72, 0.65);
      b.cylc(0.07, 0.07, 0.2, P.beam, 0, 0.15 + h - 0.15, 0.68, Math.PI / 2, 0, 0);
      for (let k = 0; k < 4; k++) b.boxc(0.16, 0.85, 0.02, 0xe9e2d0, Math.sin(k * Math.PI / 2 + 0.4) * 0.45, 0.15 + h - 0.15 + Math.cos(k * Math.PI / 2 + 0.4) * 0.45, 0.78, 0, 0, -(k * Math.PI / 2 + 0.4));
      flagPole(b, t, 0, 0, 0.15 + h + 0.55, 0.35, 0.18);
      break;
    }
    case 'farm': {
      b.box(2.9, 0.35, 2.9, 0x6b4a2e, 0, -0.25, 0);
      for (let i = 0; i < 5; i++) b.box(2.5, 0.06, 0.28, 0x5a3c24, 0, 0.1, -1.1 + i * 0.55);
      const crop = a === 0 ? 0x9bb446 : a === 1 ? 0xb9b24a : 0xd2b450;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) b.cone(0.1, 0.22 + ((i * 7 + j) % 3) * 0.04, crop, -1.1 + j * 0.37, 0.12, -1.1 + i * 0.55, 5);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, 0.3, 0.06, C.wood, sx * 1.42, 0.05, sz * 1.42);
      t.boxc(0.02, 0.12, 0.16, C.white, 1.42, 0.38, 1.33);
      break;
    }
    case 'barracks': case 'range': case 'stable': case 'workshop': case 'blacksmith': {
      foundation(b, s, P, 0.5);
      const h = 0.95 + a * 0.2;
      if (type === 'stable') {
        const top = hall(b, P, a, 0, -0.55, 2.6, 1.3, h * 0.85, 0.6, 1.6);
        for (let i = 0; i < 3; i++) b.box(0.5, 0.55, 0.04, 0x3a2a1a, -0.85 + i * 0.85, 0.15, 0.11);
        for (let i = -1; i <= 1; i++) b.box(0.06, 0.4, 0.06, C.wood, i * 1.3, 0.15, 1.35); b.box(2.65, 0.05, 0.04, C.wood, 0, 0.45, 1.35);
        b.box(0.5, 0.3, 0.4, 0xd8bf5a, 0.9, 0.15, 0.7);
        t.box(0.45, 0.35, 0.03, C.white, 0, top - 0.5, 0.11);
      } else {
        const top = hall(b, P, a, 0, -0.45, 2.4, 1.6, h, 0.8, 1.0);
        door(b, 0, 0.36, 0.46, 0.6, P); windows(b, 2.4, h, 1.6, 0.15, 3, 0, P); crate(b, 1.15, 0.55); crate(b, 1.0, 0.62, 0.15, 0.13); barrel(b, -1.25, 0.6);
        t.box(0.5, 0.55, 0.03, C.white, -0.8, 0.45, 0.37);
        if (type === 'barracks') {
          b.cyl(0.05, 0.05, 0.75, C.wood, 0.85, 0.15, 0.9, 6); b.boxc(0.45, 0.05, 0.05, C.wood, 0.85, 0.7, 0.9); b.sph(0.11, 0xcfb58a, 0.85, 0.95, 0.9);
          for (let i = 0; i < 4; i++) b.cylc(0.012, 0.012, 0.9, C.wood, -0.9 + i * 0.12, 0.6, 0.95, 0.15, 0, 0);
          b.box(0.6, 0.06, 0.06, C.wood, -0.72, 0.4, 0.95);
        } else if (type === 'range') {
          for (const x of [-0.6, 0.6]) { b.box(0.06, 0.45, 0.06, C.wood, x, 0.15, 1.0); b.cylc(0.22, 0.22, 0.05, 0xece2c6, x, 0.72, 1.0, Math.PI / 2, 0, 0, 12); b.cylc(0.13, 0.13, 0.06, 0xc0392b, x, 0.72, 1.0, Math.PI / 2, 0, 0, 12); b.cylc(0.05, 0.05, 0.07, 0xece2c6, x, 0.72, 1.0, Math.PI / 2, 0, 0, 8); }
        } else if (type === 'workshop') {
          b.box(0.1, 1.6, 0.1, C.wood, 0.95, 0.15, 0.85); b.boxc(0.08, 0.08, 1.1, C.wood, 0.95, 1.7, 0.45, 0.2, 0, 0);
          b.cylc(0.3, 0.3, 0.06, 0x3a2a1a, -0.8, 0.45, 0.95, 0, 0, Math.PI / 2, 10);
          for (let i = 0; i < 3; i++) b.cylc(0.08, 0.08, 0.9, 0x7a5232, 0.2, 0.25 + i * 0.0, 0.7 + i * 0.17, 0, 0, Math.PI / 2, 6);
        } else {
          b.box(0.4, 1.0 + h, 0.4, P.stone, 0.75, 0.15, -0.65);
          b.box(0.4, 0.3, 0.25, 0x2c2c2c, -0.6, 0.15, 0.85); b.box(0.2, 0.08, 0.2, 0xff8a2a, -0.6, 0.45, 0.85);
          b.box(0.35, 0.22, 0.18, 0x3a3d42, 0.5, 0.15, 0.85);
        }
      }
      flagPole(b, t, 1.25, -1.3, 0.1, 1.9 + a * 0.2);
      break;
    }
    case 'tower': {
      foundation(b, s, P, 0.45);
      const h = 2.3 + a * 0.6;
      b.box(1.1, h, 1.1, a === 0 ? P.wall : P.stone, 0, 0.15, 0);
      b.box(1.35, 0.18, 1.35, P.wall2, 0, 0.15 + h, 0);
      for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j += 2) {
        const ang = i * Math.PI / 2; const cx = Math.sin(ang) * 0.6, cz = Math.cos(ang) * 0.6;
        b.box(0.22, 0.22, 0.22, P.wall2, cx + Math.cos(ang) * j * 0.38, 0.33 + h, cz - Math.sin(ang) * j * 0.38);
      }
      b.box(0.3, 0.5, 0.04, 0x3a2a1a, 0, 0.15, 0.56); b.box(0.12, 0.3, 0.03, 0x2b2118, 0, 0.15 + h * 0.6, 0.56);
      if (a >= 2) b.roof(1.3, 1.3, 0.8, P.roof, 0, 0.55 + h, 0);
      t.box(1.14, 0.12, 1.14, C.white, 0, 0.15 + h * 0.75, 0);
      flagPole(b, t, 0, 0, 0.33 + h + (a >= 2 ? 0.7 : 0), 0.6, 0.26);
      break;
    }
    case 'wall': {
      const h = 1.1 + a * 0.15;
      b.box(1.0, h + 0.4, 1.0, P.stone, 0, -0.4, 0);
      b.box(1.0, 0.07, 1.0, P.wall2, 0, h * 0.5, 0);
      b.box(0.3, 0.2, 1.0, P.wall2, -0.32, h, 0); b.box(0.3, 0.2, 1.0, P.wall2, 0.32, h, 0);
      t.box(1.02, 0.06, 1.02, C.white, 0, h - 0.1, 0);
      break;
    }
    case 'gate': {
      const h = 1.4 + a * 0.15;
      b.box(0.28, h + 0.4, 1.0, P.stone, -0.36, -0.4, 0); b.box(0.28, h + 0.4, 1.0, P.stone, 0.36, -0.4, 0);
      b.box(1.0, 0.35, 1.0, P.wall2, 0, h - 0.2, 0);
      b.box(0.42, h - 0.25, 0.08, 0x5a3e24, 0, 0.0, 0);
      t.box(0.5, 0.35, 0.02, C.white, 0, h - 0.6, 0.52); t.box(0.5, 0.35, 0.02, C.white, 0, h - 0.6, -0.52);
      break;
    }
    case 'castle': {
      foundation(b, s, P, 0.7);
      b.box(3.3, 1.2, 3.3, P.stone, 0, 0.15, 0);
      for (let i = -3; i <= 3; i += 2) for (const [sx, sz, rot] of [[0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1]]) b.box(0.25, 0.22, 0.25, P.wall2, rot ? sx * 1.55 : i * 0.42, 1.35, rot ? i * 0.42 : sz * 1.55);
      b.box(1.7, 2.5, 1.7, P.wall, 0, 0.15, 0);
      for (let i = 0; i < 4; i++) b.box(0.3, 0.25, 0.3, P.wall2, (i % 2 ? 1 : -1) * 0.7, 2.65, (i < 2 ? 1 : -1) * 0.7);
      b.roof(1.4, 1.4, 0.9, P.roof, 0, 2.65, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl(0.5, 0.56, 2.0, P.wall, sx * 1.62, 0.15, sz * 1.62, 10); b.cone(0.62, 0.8, P.roof, sx * 1.62, 2.15, sz * 1.62, 10); }
      b.box(0.65, 0.9, 0.05, 0x2b2118, 0, 0.15, 1.66);
      t.box(0.04, 0.9, 0.55, C.white, 0.87, 1.4, 0); t.box(0.04, 0.9, 0.55, C.white, -0.87, 1.4, 0); t.box(0.55, 0.9, 0.04, C.white, 0, 1.4, 0.87);
      flagPole(b, t, 0, 0, 3.4, 0.9, 0.4);
      break;
    }
    case 'wonder': {
      const st = 0xe0d5b8, st2 = 0xcfc3a3;
      b.box(4.9, 0.9, 4.9, st2, 0, -0.5, 0);
      b.box(4.1, 0.7, 4.1, st, 0, 0.4, 0); b.box(3.3, 0.7, 3.3, st2, 0, 1.1, 0); b.box(2.5, 0.7, 2.5, st, 0, 1.8, 0);
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.08, 0.08, 1.0, 0xf2ead6, sx * (0.55 + i * 0.0) * (i % 2 ? 1 : 0.4) + sx * 0.3, 2.5, sz * 0.95, 8);
      b.box(1.5, 1.0, 1.5, 0xf0e6cc, 0, 2.5, 0);
      b.roof(1.9, 1.9, 0.9, 0xe9c040, 0, 3.5, 0);
      b.cyl(0.06, 0.14, 1.4, 0xf1cd4a, 0, 4.2, 0, 6); b.sph(0.14, 0xffe27a, 0, 5.65, 0);
      b.box(0.8, 1.2, 0.5, st2, 0, 0.0, 2.4); for (let i = 0; i < 4; i++) b.box(0.8, 0.12, 0.3, st, 0, -0.1 + i * 0.25, 2.55 - i * 0.12);
      for (const [x, z, ry] of [[0, 2.06, 0], [0, -2.06, 0], [2.06, 0, Math.PI / 2], [-2.06, 0, Math.PI / 2]]) t.add(new THREE.BoxGeometry(0.7, 0.6, 0.03), C.white, x * 0.82, 1.5, z * 0.82, 0, ry, 0);
      break;
    }
  }
  return (BM[key] = { base: b.geo(), team: t.geo() });
}
const SCAF = {};
function scaffoldGeo(size) {
  if (SCAF[size]) return SCAF[size];
  const b = new MB(), h = size >= 3 ? 1.6 : size === 1 ? 0.8 : 1.2, e = size / 2 - 0.08, col = 0x9c7a4a;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, h, 0.06, col, sx * e, 0, sz * e);
  for (const y of [0.4, h - 0.05]) { b.box(size - 0.1, 0.05, 0.05, col, 0, y, e); b.box(size - 0.1, 0.05, 0.05, col, 0, y, -e); b.box(0.05, 0.05, size - 0.1, col, e, y, 0); b.box(0.05, 0.05, size - 0.1, col, -e, y, 0); }
  b.box(size - 0.1, 0.1, size - 0.1, 0x8d8577, 0, -0.05, 0);
  return (SCAF[size] = b.geo());
}

// ------------------------------------------------------------------
//  RESOURCE MODELS
// ------------------------------------------------------------------
function buildResourceModels() {
  const R = {};
  let b = new MB(); b.cyl(0.055, 0.1, 0.6, 0x5e4128, 0, 0, 0, 7); for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; b.add(new THREE.ConeGeometry(0.04, 0.16, 4), 0x5e4128, Math.cos(a) * 0.08, 0.04, Math.sin(a) * 0.08, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); } R.trunk = b.geo();
  // pine: five jagged tiers, darker at the bottom
  b = new MB();
  const pg = [0x24582c, 0x2d6634, 0x35733b, 0x3f8143, 0x4a8f4a];
  for (let k = 0; k < 5; k++) { const r = 0.52 - k * 0.085, y = 0.28 + k * 0.22; b.add(new THREE.ConeGeometry(r, 0.46, 9), pg[k], 0, y + 0.23, 0, 0, k * 0.5, 0); b.add(new THREE.ConeGeometry(r * 0.92, 0.4, 7), pg[Math.max(0, k - 1)], 0.02, y + 0.17, -0.02, 0.05, k * 0.9, 0.04); }
  b.add(new THREE.ConeGeometry(0.08, 0.3, 6), 0x4f9a4f, 0, 1.52, 0);
  R.pine = b.geo();
  // oak: clustered leafy blobs in several greens
  b = new MB();
  const og = [0x3f7a2e, 0x4c8a36, 0x5a9a3e, 0x366c28, 0x67a646];
  b.cylc(0.03, 0.045, 0.35, 0x5e4128, 0.12, 0.62, 0, 0, 0, -0.6, 6); b.cylc(0.03, 0.045, 0.32, 0x5e4128, -0.1, 0.62, 0.05, 0.3, 0, 0.6, 6);
  const blobs = [[0, 0.95, 0, 0.42], [0.26, 0.86, 0.12, 0.3], [-0.24, 0.84, -0.1, 0.3], [0.08, 1.2, -0.1, 0.3], [-0.12, 1.08, 0.22, 0.27], [0.2, 1.06, -0.24, 0.25], [-0.28, 1.0, 0.18, 0.22], [0.02, 0.74, 0.26, 0.24]];
  blobs.forEach(([x, y, z, r], k) => b.ico(r, og[k % og.length], x, y, z, 1, 0.88, 1, k));
  R.oak = b.geo();
  // birch: slim pale trunk + light airy canopy
  b = new MB();
  b.cyl(0.035, 0.05, 1.15, 0xe9e4d8, 0, 0, 0, 7);
  for (let k = 0; k < 6; k++) b.box(0.075, 0.025, 0.075, 0x2f2a26, 0, 0.12 + k * 0.17, 0, k);
  const bgc = [0x7fb04a, 0x8fbd55, 0x6fa040, 0x9cc85e];
  [[0, 1.2, 0, 0.28], [0.15, 1.0, 0.08, 0.22], [-0.14, 1.05, -0.06, 0.22], [0.05, 1.42, -0.04, 0.2], [-0.06, 0.88, 0.14, 0.18]].forEach(([x, y, z, r], k) => b.ico(r, bgc[k % 4], x, y, z, 1, 1.25, 1, k));
  R.birch = b.geo();
  // gold mine: rock outcrop with golden veins and nuggets
  b = new MB();
  const rk = [0x6f685c, 0x7d7465, 0x887f6f, 0x625c52];
  [[-0.25, 0.25, -0.2, 0.5, 0.8], [0.35, 0.2, 0.15, 0.42, 0.75], [-0.1, 0.18, 0.5, 0.3, 0.7], [0.45, 0.14, -0.4, 0.26, 0.7], [-0.55, 0.12, 0.3, 0.24, 0.6], [0.05, 0.42, -0.05, 0.3, 0.9]].forEach(([x, y, z, r, sy], k) => b.dod(r, rk[k % 4], x, y, z, 1, sy, 1, k));
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.25 + (i % 4) * 0.13; b.dod(0.06 + (i % 3) * 0.035, i % 3 ? 0xf2c537 : 0xffd95a, Math.cos(a) * r, 0.18 + (i % 4) * 0.1, Math.sin(a) * r, 1, 0.8, 1, i); }
  b.box(0.18, 0.08, 0.1, 0x6b4a2b, 0.6, 0.0, 0.55); b.dod(0.05, 0xf2c537, 0.6, 0.12, 0.55);
  R.gold = b.geo();
  // stone mine: stacked slabs of pale granite
  b = new MB();
  const sg = [0x9a9a9e, 0xb2b2b6, 0x8a8a8f, 0xa6a6ab, 0xc0c0c4];
  [[-0.2, 0.22, -0.2, 0.48, 0.7], [0.35, 0.2, 0.2, 0.4, 0.75], [-0.15, 0.17, 0.45, 0.32, 0.7], [0.4, 0.14, -0.35, 0.26, 0.8], [0.0, 0.5, 0.0, 0.3, 0.6], [-0.5, 0.12, 0.05, 0.22, 0.7]].forEach(([x, y, z, r, sy], k) => b.dod(r, sg[k % 5], x, y, z, 1.1, sy, 0.95, k * 0.7));
  for (let i = 0; i < 4; i++) b.box(0.22, 0.08, 0.16, sg[(i + 2) % 5], 0.55 - i * 0.05, 0.0 + i * 0.08 * 0, 0.55 - i * 0.12, i);
  R.stone = b.geo();
  b = new MB(); b.sph(0.32, 0x3f7a35, 0, 0.26, 0, 1, 0.8, 1); b.sph(0.22, 0x4a8a3c, 0.2, 0.3, 0.12);
  for (let i = 0; i < 12; i++) { const a = i * 2.1, h = 0.18 + (i % 4) * 0.08; b.sph(0.045, 0xd62e3a, Math.cos(a) * 0.3, h + 0.05, Math.sin(a) * 0.3, 1, 1, 1, 5, 4); }
  R.berry = b.geo();
  b = new MB(); b.boxc(0.4, 0.14, 0.2, 0x8a5a3a, 0, 0.07, 0); b.boxc(0.08, 0.06, 0.14, 0x6b4a2c, 0.24, 0.05, 0.05); b.boxc(0.15, 0.04, 0.03, 0x6b4a2c, -0.1, 0.03, 0.15); R.carcass = b.geo();
  b = new MB(); b.cyl(0.09, 0.11, 0.14, 0x7a5a3a, 0, 0, 0, 7); b.cyl(0.085, 0.085, 0.01, 0xc9a070, 0, 0.14, 0, 7); R.stump = b.geo();
  b = new MB();
  for (let i = 0; i < 7; i++) { const a = i * 2.39, r = 0.03 + (i % 3) * 0.035, h = 0.13 + (i % 4) * 0.045; const gc = [0x5f9a36, 0x6fab3e, 0x83b84a, 0x4e8a30][i % 4]; b.add(new THREE.ConeGeometry(0.022, h, 3), gc, Math.cos(a) * r, h / 2, Math.sin(a) * r, Math.sin(a) * 0.25, a, Math.cos(a) * 0.25); }
  R.tuft = b.geo();
  b = new MB(); b.add(new THREE.ConeGeometry(0.01, 0.16, 3), 0x4e8a30, 0, 0.08, 0); for (let i = 0; i < 5; i++) { const a = i * 1.257; b.sph(0.022, 0xffffff, Math.cos(a) * 0.025, 0.17, Math.sin(a) * 0.025, 1, 0.6, 1, 5, 3); } b.sph(0.016, 0xf2c537, 0, 0.18, 0, 1, 1, 1, 5, 3);
  b.add(new THREE.ConeGeometry(0.01, 0.12, 3), 0x5f9a36, 0.06, 0.06, 0.03); for (let i = 0; i < 4; i++) { const a = i * 1.57; b.sph(0.018, 0xffffff, 0.06 + Math.cos(a) * 0.02, 0.125, 0.03 + Math.sin(a) * 0.02, 1, 0.6, 1, 5, 3); }
  R.flower = b.geo();
  b = new MB(); b.dod(0.07, 0x8f8a80, 0, 0.02, 0, 1, 0.55, 1); b.dod(0.045, 0x7c776e, 0.08, 0.01, 0.04, 1, 0.6, 1); R.pebble = b.geo();
  b = new MB(); b.sph(0.18, 0x4a7f34, 0, 0.12, 0, 1, 0.75, 1, 8, 6); b.sph(0.13, 0x5a9040, 0.12, 0.1, 0.06, 1, 0.75, 1, 7, 5); b.sph(0.12, 0x427530, -0.1, 0.09, -0.06, 1, 0.75, 1, 7, 5); R.shrub = b.geo();
  return R;
}

// ------------------------------------------------------------------
//  PARTICLES (one draw call per blend mode)
// ------------------------------------------------------------------
class PSystem {
  constructor(cap, additive) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.alpha = new Float32Array(cap); this.grow = new Float32Array(cap); this.grav = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('pcol', this.aCol); g.setAttribute('psize', this.aSize);
    g.setDrawRange(0, 0);
    this.uScale = { value: 400 };
    const m = new THREE.ShaderMaterial({
      uniforms: { uFog: U.uFog, uScale: this.uScale, uMapN: U.uMapN },
      vertexShader: `attribute vec4 pcol; attribute float psize; varying vec4 vC; varying vec2 vF; uniform float uScale; uniform float uMapN;
        void main(){ vC = pcol; vF = position.xz / uMapN; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uFog; varying vec4 vC; varying vec2 vF;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float f = texture2D(uFog, vF).r; float a = vC.a * smoothstep(0.5, 0.15, r) * step(0.2, f); gl_FragColor = vec4(vC.rgb * f, a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = additive ? 6 : 5;
    this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, a, grow = 0, grav = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.alpha[i] = a; this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.grav[i] = grav;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; }
          for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[j * 4 + k];
          this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.alpha[i] = this.alpha[j]; this.grow[i] = this.grow[j]; this.grav[i] = this.grav[j];
        }
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.max[i];
      this.col[i * 4 + 3] = this.alpha[i] * Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 8 + 0.2);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}
const PFX = {
  add: null, norm: null,
  init() {
    const lim = Settings.quality === 'low' ? 0.5 : 1;
    this.add = new PSystem((1500 * lim) | 0, true); this.norm = new PSystem((2000 * lim) | 0, false);
    scene.add(this.add.points); scene.add(this.norm.points); this.resize();
  },
  resize() { if (!this.add) return; const s = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)); this.add.uScale.value = s; this.norm.uScale.value = s; },
  update(dt) { this.add.update(dt); this.norm.update(dt); },
  clear() { this.add.clear(); this.norm.clear(); },
  fire(x, y, z, k = 1) {
    this.add.emit(x + rand(-0.3, 0.3) * k, y, z + rand(-0.3, 0.3) * k, rand(-0.1, 0.1), rand(0.6, 1.2), rand(-0.1, 0.1), rand(0.5, 0.9), rand(0.35, 0.6) * k, 1, rand(0.4, 0.6), 0.1, 0.8, -0.3);
    if (Math.random() < 0.4) this.norm.emit(x + rand(-0.2, 0.2), y + 0.5, z + rand(-0.2, 0.2), rand(-0.1, 0.2), rand(0.5, 0.9), rand(-0.1, 0.1), rand(1.5, 2.5), 0.4 * k, 0.22, 0.2, 0.2, 0.45, 0.6);
  },
  smoke(x, y, z) { this.norm.emit(x, y, z, rand(0.0, 0.15), rand(0.35, 0.6), rand(-0.05, 0.08), rand(2.5, 3.5), 0.25, 0.75, 0.75, 0.75, 0.3, 0.35); },
  dust(x, y, z, n = 10, s = 1) { for (let i = 0; i < n; i++) this.norm.emit(x + rand(-1, 1) * s, y + rand(0, 0.5), z + rand(-1, 1) * s, rand(-0.6, 0.6), rand(0.2, 1.0), rand(-0.6, 0.6), rand(1, 2), rand(0.5, 1.0) * s, 0.55, 0.47, 0.37, 0.6, 0.8, 0.2); },
  chips(x, y, z, col) { const c = new THREE.Color(col); for (let i = 0; i < 3; i++) this.norm.emit(x, y, z, rand(-0.8, 0.8), rand(1, 2), rand(-0.8, 0.8), 0.5, 0.08, c.r, c.g, c.b, 1, 0, 6); },
  blood(x, y, z) { for (let i = 0; i < 4; i++) this.norm.emit(x, y, z, rand(-0.6, 0.6), rand(0.6, 1.4), rand(-0.6, 0.6), 0.45, 0.07, 0.55, 0.06, 0.05, 0.9, 0, 6); },
  spark(x, y, z) { for (let i = 0; i < 4; i++) this.add.emit(x, y, z, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), 0.25, 0.08, 1, 0.85, 0.5, 1, 0, 4); },
  mote(x, y, z) { this.add.emit(x, y, z, rand(-0.15, 0.15), rand(-0.05, 0.08), rand(-0.15, 0.15), rand(4, 7), rand(0.06, 0.1), 1, 0.95, 0.7, 0.5, 0, 0); },
  leaf(x, y, z) { this.norm.emit(x, y, z, rand(0.2, 0.5), rand(-0.25, -0.1), rand(-0.1, 0.2), rand(3, 5), 0.07, 0.45, 0.6, 0.25, 0.9, 0, 0); },
};
