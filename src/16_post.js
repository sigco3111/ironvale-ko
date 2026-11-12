// =====================================================================
//  POST-PROCESSING — the scene is rendered to a texture (with depth),
//  then: ambient occlusion, bloom, colour grading, vignette, and FXAA.
//  Disabled on Low quality or when the GPU lacks depth textures.
// =====================================================================
const Post = (() => {
  let rtA = null, rtB = null, quad, cam, sceneP, matMain, matFxaa, supported = true, enabled = false, hitV = 0;
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const FS_MAIN = `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uAO, uBloom, uVig, uSat, uHit, uNight, uTime; uniform vec3 uHaze;
    varying vec2 vUv;
    float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float d0 = lin(texture2D(tDepth, vUv).x);
      // --- ambient occlusion from mirrored depth pairs (flat ground cancels out, creases darken) ---
      float ao = 0.0;
      if (uAO > 0.0 && d0 < uFar * 0.6) {
        float rad = clamp(46.0 / d0, 2.5, 26.0) * uRes.y / 900.0;
        float ang = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 3.1416;
        for (int i = 0; i < 4; i++) {
          float a = ang + float(i) * 0.7854, r = rad * (0.45 + 0.55 * fract(float(i) * 0.618 + 0.3));
          vec2 o = vec2(cos(a), sin(a)) * r / uRes;
          float d1 = lin(texture2D(tDepth, vUv + o).x), d2 = lin(texture2D(tDepth, vUv - o).x);
          float s = (d0 - d1) + (d0 - d2);
          float rng = 1.0 - smoothstep(0.9, 2.4, max(abs(d0 - d1), abs(d0 - d2)));
          ao += smoothstep(0.03, 0.45, s) * rng;
        }
        ao *= 0.25;
      }
      c *= 1.0 - ao * uAO;
      // --- aerial perspective: distant things fade softly toward the sky colour ---
      if (d0 < uFar * 0.8) c = mix(c, uHaze, clamp(1.0 - exp(-max(d0 - 14.0, 0.0) * 0.0042), 0.0, 0.42));
      // --- bloom: glow around bright pixels ---
      if (uBloom > 0.0) {
        vec3 bl = vec3(0.0);
        for (int i = 0; i < 12; i++) { float a = float(i) * 2.399, r = (2.5 + float(i) * 1.7) * uRes.y / 900.0; vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r / uRes).rgb; bl += max(s - (0.74 - uNight * 0.22), 0.0); }
        c += bl / 12.0 * uBloom * (1.0 + uNight * 1.2);
      }
      // --- grade: saturation, gentle S-curve, warm highlights / cool shadows, vignette ---
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      // natural film look: tame over-bright greens, soft contrast, lifted blacks, faint grain
      float greenPop = max(c.g - max(c.r, c.b), 0.0);
      c.g -= greenPop * 0.22; c.r += greenPop * 0.07;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.14);
      c = c * 0.965 + 0.022;
      c += vec3(0.02, 0.01, -0.012) * smoothstep(0.5, 1.0, l) + vec3(-0.008, 0.0, 0.014) * (1.0 - smoothstep(0.0, 0.4, l));
      c += (fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;
      vec2 q = vUv - 0.5; float v = dot(q, q);
      c *= 1.0 - v * uVig;
      c = mix(c, vec3(0.75, 0.06, 0.03), clamp(uHit * v * 2.2, 0.0, 0.6));
      gl_FragColor = vec4(c, 1.0);
    }`;
  const FS_FXAA = `
    uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 px = 1.0 / uRes; vec3 lu = vec3(0.299, 0.587, 0.114);
      vec3 cNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb, cNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * px).rgb;
      vec3 cSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * px).rgb, cSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * px).rgb, cM = texture2D(tDiffuse, vUv).rgb;
      float lNW = dot(cNW, lu), lNE = dot(cNE, lu), lSW = dot(cSW, lu), lSE = dot(cSE, lu), lM = dot(cM, lu);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), vec2(-8.0), vec2(8.0)) * px;
      vec3 A = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 B = A * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lB = dot(B, lu);
      gl_FragColor = vec4((lB < lMin || lB > lMax) ? A : B, 1.0);
    }`;
  function init() {
    supported = renderer.capabilities.isWebGL2 || !!renderer.extensions.get('WEBGL_depth_texture');
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); sceneP = new THREE.Scene();
    matMain = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_MAIN, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 1 }, uFar: { value: 1200 }, uAO: { value: 0.6 }, uBloom: { value: 0.32 }, uVig: { value: 0.38 }, uSat: { value: 0.84 }, uTime: { value: 0 }, uHaze: { value: new THREE.Color(0xbcd6e8) }, uHit: { value: 0 }, uNight: { value: 0 } } });
    matFxaa = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_FXAA, depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } } });
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matMain); quad.frustumCulled = false; sceneP.add(quad);
    camera.near = 1; camera.updateProjectionMatrix();
    sync();
  }
  function sync() { enabled = supported && Settings.quality !== 'low'; if (matMain) matMain.uniforms.uAO.value = Settings.quality === 'high' ? 0.75 : 0.6; }
  function ensure(w, h) {
    if (rtA && rtA.width === w && rtA.height === h) return;
    if (rtA) { rtA.dispose(); rtB.dispose(); }
    rtA = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    rtA.texture.encoding = THREE.sRGBEncoding;
    rtA.depthTexture = new THREE.DepthTexture(w, h); rtA.depthTexture.type = THREE.UnsignedIntType;
    rtB = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false });
  }
  const size = new THREE.Vector2();
  function render(dt) {
    if (hitV > 0) hitV = Math.max(0, hitV - (dt || 0.016) * 0.9);
    if (!enabled) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    try {
      renderer.getDrawingBufferSize(size); const w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);
      ensure(w, h);
      renderer.setRenderTarget(rtA); renderer.render(scene, camera);
      const u = matMain.uniforms; u.tDiffuse.value = rtA.texture; u.tDepth.value = rtA.depthTexture; u.uRes.value.set(w, h); u.uNear.value = camera.near; u.uFar.value = camera.far; u.uHit.value = hitV;
      u.uNight.value = 1 - U.uDay.raw; u.uTime.value = U.uTime.value % 100; u.uHaze.value.copy(U.uSky.value);
      quad.material = matMain; renderer.setRenderTarget(rtB); renderer.render(sceneP, cam);
      matFxaa.uniforms.tDiffuse.value = rtB.texture; matFxaa.uniforms.uRes.value.set(w, h);
      quad.material = matFxaa; renderer.setRenderTarget(null); renderer.render(sceneP, cam);
    } catch (e) { console.warn('post-processing disabled:', e); supported = false; enabled = false; renderer.setRenderTarget(null); renderer.render(scene, camera); }
  }
  return { init, sync, render, hit() { hitV = 1; }, get enabled() { return enabled; } };
})();
