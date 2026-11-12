// =====================================================================
//  ATMOSPHERE — day/night cycle, weather (rain, storm, snow, fog),
//  stars, night lights, wind. Inspired by lush "pure nature" scenes:
//  soft golden light, aerial fog, swaying meadows.
// =====================================================================
const Atmos = (() => {
  // time of day: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  let tod = 0.36, weather = 'clear', wAmt = 0, wTarget = 0, nextChange = 120, flashT = 0, boltT = 8, skyT = 0, glowT = 0;
  let rain, rainPos, snow, snowPos, stars, glow, glowPos, glowCol, lights = [], flashEl;
  const RAIN_N = 2200, SNOW_N = 1800, GLOW_N = 400;
  const cTmp = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color();
  const WEATHERS = ['clear', 'rain', 'storm', 'snow', 'fog'];
  const THEME_WEATHER = { vale: ['clear', 'clear', 'rain', 'fog', 'storm'], highlands: ['clear', 'snow', 'fog', 'rain', 'snow'], coast: ['clear', 'clear', 'storm', 'rain'], wilds: ['clear', 'rain', 'storm', 'fog', 'rain'], marsh: ['fog', 'fog', 'rain', 'storm', 'clear'] };

  function init() {
    // rain streaks
    const rg = new THREE.BufferGeometry(); rainPos = new Float32Array(RAIN_N * 6);
    rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0.4, depthWrite: false }));
    rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 9; scene.add(rain);
    // snowflakes
    const sg = new THREE.BufferGeometry(); snowPos = new Float32Array(SNOW_N * 3);
    sg.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
    const fc = document.createElement('canvas'); fc.width = fc.height = 32; const fg = fc.getContext('2d'); const fgr = fg.createRadialGradient(16, 16, 0, 16, 16, 16); fgr.addColorStop(0, 'rgba(255,255,255,1)'); fgr.addColorStop(0.5, 'rgba(255,255,255,.8)'); fgr.addColorStop(1, 'rgba(255,255,255,0)'); fg.fillStyle = fgr; fg.fillRect(0, 0, 32, 32);
    snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, map: new THREE.CanvasTexture(fc), transparent: true, opacity: 0.95, depthWrite: false }));
    snow.frustumCulled = false; snow.visible = false; snow.renderOrder = 9; scene.add(snow);
    for (let i = 0; i < SNOW_N; i++) { snowPos[i * 3] = rand(-35, 35); snowPos[i * 3 + 1] = rand(0, 26); snowPos[i * 3 + 2] = rand(-35, 35); }
    for (let i = 0; i < RAIN_N; i++) { const x = rand(-35, 35), y = rand(0, 28), z = rand(-35, 35); rainPos.set([x, y, z, x, y - 0.6, z], i * 6); }
    // stars on the sky dome
    const st = new THREE.BufferGeometry(), sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3 + 0.12; sp.set([Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 300, Math.sin(a) * Math.cos(e) * 300], i * 3); }
    st.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    stars = new THREE.Points(st, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    stars.frustumCulled = false; stars.renderOrder = -9; scene.add(stars);
    // warm glows for lanterns, fires and windows at night
    const gg = new THREE.BufferGeometry(); glowPos = new Float32Array(GLOW_N * 3); glowCol = new Float32Array(GLOW_N * 3);
    gg.setAttribute('position', new THREE.BufferAttribute(glowPos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(glowCol, 3)); gg.setDrawRange(0, 0);
    glow = new THREE.Points(gg, new THREE.PointsMaterial({ size: 2.2, map: glowTexture(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.frustumCulled = false; glow.renderOrder = 7; scene.add(glow);
    // a small pool of real point lights, moved to the lit places nearest the camera
    if (Settings.quality !== 'low') for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffa860, 0, 9, 2); scene.add(l); lights.push(l); }
    flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:fixed;inset:0;background:#dfe8ff;opacity:0;pointer-events:none;z-index:3;transition:opacity .08s';
    document.body.appendChild(flashEl);
  }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,210,150,.55)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  function reset() {
    const mode = Settings.timeMode || 'cycle';
    tod = mode === 'night' ? 0.92 : mode === 'dusk' ? 0.72 : mode === 'day' ? 0.45 : 0.33;
    const w = Settings.weather || 'dynamic';
    weather = w === 'dynamic' ? 'clear' : w; wAmt = wTarget = weather === 'clear' ? 0 : 1; nextChange = rand(150, 260);
    U.uSnow.value = weather === 'snow' ? 0.7 : 0; U.uWet.value = 0;
    rebuildGlows();
  }
  function setWeather(w) { weather = w; wTarget = w === 'clear' ? 0 : 1; if (Game.mode === 'play') UI.notify({ clear: 'The skies clear', rain: 'It starts to rain', storm: 'A storm rolls in!', snow: 'Snow begins to fall', fog: 'A thick fog creeps in' }[w], '', 'wx'); }
  // places that glow at night
  function rebuildGlows() {
    let n = 0;
    const put = (x, y, z, r, g, b) => { if (n >= GLOW_N) return; glowPos.set([x, y, z], n * 3); glowCol.set([r, g, b], n * 3); n++; };
    const fx = World.theme && World.theme.dark ? 0.9 : 1;
    for (const b of buildings) {
      if (b.dead || !b.built) continue;
      const k = b.type === 'towncenter' || b.type === 'castle' ? 3 : b.type === 'house' || b.type === 'tower' || b.type === 'mill' || b.type === 'blacksmith' ? 1 : 0;
      for (let i = 0; i < k; i++) { const a = i * 2.1 + b.id; put(b.x + Math.cos(a) * b.size * 0.35, b.y + 0.8 + i * 0.25, b.z + Math.sin(a) * b.size * 0.35, 1, 0.75 * fx, 0.4); }
    }
    for (const p of World.props || []) if (/lantern|bonfire|campfire|jacko|post_lantern|crystal/.test(p.name)) { const cr = /crystal/.test(p.name); put(p.tx + p.s / 2, heightAt(p.tx + p.s / 2, p.ty + p.s / 2) + (/lantern/.test(p.name) ? 1.0 : 0.4), p.ty + p.s / 2, cr ? 0.4 : 1, cr ? 0.6 : 0.6, cr ? 1 : 0.25); }
    glow.geometry.setDrawRange(0, n); glow.geometry.attributes.position.needsUpdate = true; glow.geometry.attributes.color.needsUpdate = true;
    glow.userData.n = n;
  }
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function update(dt, gameDt) {
    const TH = World.theme || MAP_THEMES.vale, mode = Settings.timeMode || 'cycle';
    // ---- time of day ----
    if (mode === 'cycle') tod = (tod + gameDt / 720) % 1; // 12 minute day
    else { const target = mode === 'night' ? 0.92 : mode === 'dusk' ? 0.72 : 0.45; tod += (target - tod) * Math.min(1, dt * 0.8); }
    const elev = Math.sin((tod - 0.25) * Math.PI * 2);           // sun height -1..1
    const day = smooth(-0.1, 0.22, elev), gold = day * (1 - smooth(0.08, 0.45, elev)), night = 1 - day;
    // ---- weather ----
    if ((Settings.weather || 'dynamic') === 'dynamic' && Game.mode !== 'loading') {
      nextChange -= gameDt;
      if (nextChange <= 0) { const list = THEME_WEATHER[World.themeKey] || THEME_WEATHER.vale; let w = pick(list); if (w === weather) w = 'clear'; setWeather(w); nextChange = rand(150, 300); }
    } else if (Settings.weather && Settings.weather !== 'dynamic' && weather !== Settings.weather) setWeather(Settings.weather);
    wAmt += (wTarget - wAmt) * Math.min(1, dt * 0.35);
    const raining = (weather === 'rain' || weather === 'storm') ? wAmt : 0, storm = weather === 'storm' ? wAmt : 0, snowing = weather === 'snow' ? wAmt : 0, foggy = weather === 'fog' ? wAmt : 0;
    const overcast = Math.max(raining * 0.8, storm, snowing * 0.6, foggy * 0.7);
    U.uSnow.value += ((snowing > 0.3 ? 0.78 : 0) - U.uSnow.value) * Math.min(1, gameDt / (snowing > 0.3 ? 60 : 40));
    U.uWet.value += ((raining > 0.3 ? 1 : 0) - U.uWet.value) * Math.min(1, gameDt / 25);
    U.uDay.raw = day; U.uDay.value = day * (1 - overcast * 0.8);
    U.uWind.value += ((1 + storm * 2.2 + raining * 0.6) - U.uWind.value) * Math.min(1, dt * 0.5);
    // ---- sun / moon ----
    const az = tod * Math.PI * 2 + 0.6;
    const lightElev = day > 0.05 ? Math.max(0.12, elev) : 0.55;               // moonlight comes from high up
    const dirX = Math.cos(az) * Math.cos(lightElev), dirY = Math.sin(lightElev), dirZ = Math.sin(az) * Math.cos(lightElev);
    sun.position.set(Cam.x + dirX * 55, dirY * 55, Cam.z + dirZ * 55); sun.target.position.set(Cam.x, 0, Cam.z); sun.target.updateMatrixWorld();
    cTmp.set(TH.sun || 0xffe9c4); c2.set(0xffa25a); cTmp.lerp(c2, gold * 0.75); c3.set(0x8aa4ff); cTmp.lerp(c3, night);
    sun.color.copy(cTmp);
    sun.intensity = (lerp(0.42, TH.dark ? 0.95 : 1.15, day) - gold * 0.12) * (1 - overcast * 0.6);
    cTmp.set(0xe2efff); c3.set(0x3a4a78); cTmp.lerp(c3, night);
    hemi.color.copy(cTmp); hemi.groundColor.set(0x4a4028).lerp(c2.set(0x15161e), night);
    hemi.intensity = lerp(0.36, TH.dark ? 0.56 : 0.7, day) * (1 - overcast * 0.15);
    renderer.toneMappingExposure = lerp(0.95, 1.0, day);
    // lightning
    if (storm > 0.5 && Game.mode !== 'loading') {
      boltT -= dt;
      if (boltT <= 0) { boltT = rand(4, 12); flashT = 0.25; flashEl.style.opacity = 0.55; setTimeout(() => { flashEl.style.opacity = 0; }, 90); setTimeout(() => { flashEl.style.opacity = 0.35; setTimeout(() => flashEl.style.opacity = 0, 70); }, 180); setTimeout(() => Sound.play('thunder'), rand(300, 1600)); }
    }
    if (flashT > 0) { flashT -= dt; hemi.intensity += 2.2 * (flashT / 0.25); }
    // ---- sky & fog colours ----
    skyT -= dt;
    if (skyT <= 0) {
      skyT = 0.25;
      const horizon = new THREE.Color(TH.sky || SKY).lerp(c2.set(0xf2a868), gold * 0.8).lerp(c3.set(0x0d1426), night * 0.92).lerp(cTmp.set(0x8c96a2), overcast * 0.7);
      if (snowing > 0.3) horizon.lerp(cTmp.set(0xcfd6de), snowing * 0.4);
      const top = new THREE.Color(TH.dark ? 0x46505e : 0x4a88d4).lerp(c2.set(0x6a70a8), gold * 0.5).lerp(c3.set(0x03060f), night * 0.95).lerp(cTmp.set(0x6c7480), overcast * 0.75);
      scene.background.copy(horizon); renderer.setClearColor(horizon); U.uSky.value.copy(horizon);
      scene.fog.color.copy(horizon.clone().convertSRGBToLinear());
      if (window.skyDome) {
        const g = skyDome.geometry, pa = g.attributes.position, cl = g.attributes.color, c = new THREE.Color();
        for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 320; c.copy(horizon).lerp(top, clamp(y * 1.7, 0, 1)); c.convertSRGBToLinear(); cl.setXYZ(i, c.r, c.g, c.b); }
        cl.needsUpdate = true;
      }
      stars.material.opacity = night * (1 - overcast) * 0.95;
      glow.material.opacity = smooth(0.25, 0.8, night) * (glow.userData.n ? 1 : 0);
    }
    // aerial fog: soft and far by day, heavy in fog / storm weather
    const fogMul = 1 - foggy * 0.78 - raining * 0.35 - snowing * 0.3;
    scene.fog.near = (60 + Cam.dist * 1.2) * Math.max(0.12, fogMul) * (foggy > 0.3 ? 0.4 : 1);
    scene.fog.far = (170 + Cam.dist * 2.4) * Math.max(0.25, fogMul);
    stars.position.copy(camera.position);
    // ---- night lights ----
    glowT -= dt; if (glowT <= 0) { glowT = 2; rebuildGlows(); }
    if (lights.length) {
      const lit = night > 0.3 ? glow.userData.n || 0 : 0;
      const cand = [];
      for (let i = 0; i < lit; i++) cand.push([dist2(glowPos[i * 3], glowPos[i * 3 + 2], Cam.x, Cam.z), i]);
      cand.sort((a, b) => a[0] - b[0]);
      lights.forEach((l, k) => { const c = cand[k]; if (!c || c[0] > 60 * 60) { l.intensity = 0; return; } const i = c[1]; l.position.set(glowPos[i * 3], glowPos[i * 3 + 1] + 0.3, glowPos[i * 3 + 2]); l.intensity = 1.6 * smooth(0.3, 0.8, night) * (0.9 + Math.sin(U.uTime.value * 9 + k) * 0.1); });
    }
    // ---- precipitation around the camera ----
    const R = clamp(18 + Cam.dist * 0.5, 20, 45), cx = Cam.x, cz = Cam.z, base = heightAt(cx, cz);
    rain.visible = raining > 0.02; rain.material.opacity = 0.45 * raining;
    if (rain.visible) {
      const n = Math.floor(RAIN_N * raining), wind = 4 + storm * 6, fall = 26 * gameDt / Math.max(dt, 1e-4) * dt;
      for (let i = 0; i < n; i++) {
        let o = i * 6, x = rainPos[o] + wind * dt, y = rainPos[o + 1] - fall, z = rainPos[o + 2];
        if (y < base - 1 || Math.abs(x - cx) > R || Math.abs(z - cz) > R) { x = cx + rand(-R, R); z = cz + rand(-R, R); y = base + rand(10, 26); if (Math.random() < 0.05 && Settings.quality !== 'low') PFX.norm.emit(x, heightAt(x, z) + 0.05, z, 0, 0.6, 0, 0.25, 0.06, 0.7, 0.8, 0.95, 0.5, 0, 4); }
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x - wind * 0.03; rainPos[o + 4] = y + 0.7; rainPos[o + 5] = z;
      }
      for (let i = n; i < RAIN_N; i++) rainPos[i * 6 + 1] = rainPos[i * 6 + 4] = -100;
      rain.geometry.attributes.position.needsUpdate = true;
    }
    snow.visible = snowing > 0.02; snow.material.opacity = 0.9 * snowing;
    if (snow.visible) {
      const t = U.uTime.value;
      for (let i = 0; i < SNOW_N; i++) {
        let o = i * 3, x = snowPos[o] + Math.sin(t * 0.7 + i) * 0.6 * dt + dt * 0.6, y = snowPos[o + 1] - 1.6 * dt, z = snowPos[o + 2] + Math.cos(t * 0.5 + i) * 0.5 * dt;
        if (y < base - 1 || Math.abs(x - cx) > R || Math.abs(z - cz) > R) { x = cx + rand(-R, R); z = cz + rand(-R, R); y = base + rand(4, 22); }
        snowPos[o] = x; snowPos[o + 1] = y; snowPos[o + 2] = z;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
    Sound.setRain(raining, storm);
  }
  function cycleTime() { const l = ['cycle', 'day', 'dusk', 'night']; Settings.timeMode = l[(l.indexOf(Settings.timeMode || 'cycle') + 1) % l.length]; saveSettings(); UI.notify('Time of day: ' + { cycle: 'day/night cycle', day: 'always day', dusk: 'golden dusk', night: 'night' }[Settings.timeMode], '', 'tm'); return Settings.timeMode; }
  function cycleWeather() { const l = ['dynamic', ...WEATHERS]; Settings.weather = l[(l.indexOf(Settings.weather || 'dynamic') + 1) % l.length]; saveSettings(); if (Settings.weather === 'dynamic') UI.notify('Weather: dynamic (changes over time)', '', 'wx2'); else setWeather(Settings.weather); return Settings.weather; }
  return { init, reset, update, cycleTime, cycleWeather, get tod() { return tod; }, get weather() { return weather; } };
})();
