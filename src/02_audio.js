// =====================================================================
//  AUDIO — every sound is synthesised with the Web Audio API
// =====================================================================
const Sound = (() => {
  let ctx = null, master, sfx, music, noiseBuf, comp;
  const last = {};
  let intensity = 0, targetIntensity = 0;
  let musicOn = false, nextBar = 0, bar = 0, schedTimer = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    music = ctx.createGain(); music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolume();
  }
  function applyVolume() {
    if (!ctx) return;
    master.gain.value = 1;
    sfx.gain.value = (Settings.volume / 100) * 0.9;
    music.gain.value = (Settings.music / 100) * 0.35;
  }
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + dec);
  }
  function osc(type, freq, t, dur, vol, out, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(out || sfx); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, vol, ftype, freq, q, out, f2) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(out || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const SFX = {
    click: (t, v) => { osc('sine', 1300, t, 0.05, 0.12 * v); osc('triangle', 700, t, 0.04, 0.06 * v); },
    chop: (t, v) => { noise(t, 0.09, 0.5 * v, 'bandpass', 1100 + Math.random() * 300, 2); osc('sine', 190, t, 0.08, 0.35 * v, null, 110); },
    mine: (t, v) => { const f = 1700 + Math.random() * 400; osc('triangle', f, t, 0.22, 0.18 * v); osc('sine', f * 1.51, t, 0.15, 0.08 * v); noise(t, 0.04, 0.3 * v, 'highpass', 3000, 1); },
    hammer: (t, v) => { osc('sine', 160, t, 0.1, 0.4 * v, null, 70); noise(t, 0.05, 0.3 * v, 'bandpass', 2200, 3); },
    farm: (t, v) => { noise(t, 0.12, 0.18 * v, 'bandpass', 600, 1.2); },
    sword: (t, v) => { const b = 2000 + Math.random() * 600; osc('square', b, t, 0.12, 0.05 * v); osc('triangle', b * 1.42, t, 0.18, 0.08 * v); osc('sine', b * 2.1, t, 0.1, 0.05 * v); noise(t, 0.06, 0.35 * v, 'highpass', 4000, 1); },
    hit: (t, v) => { noise(t, 0.08, 0.35 * v, 'lowpass', 900, 1); osc('sine', 120, t, 0.08, 0.25 * v, null, 60); },
    arrow: (t, v) => { noise(t, 0.22, 0.25 * v, 'bandpass', 3200, 4, null, 700); },
    gallop: (t, v) => { for (let i = 0; i < 4; i++) { const tt = t + i * 0.09 + (i > 1 ? 0.06 : 0); osc('sine', 95 + Math.random() * 20, tt, 0.06, 0.3 * v, null, 50); noise(tt, 0.03, 0.12 * v, 'lowpass', 500, 1); } },
    collapse: (t, v) => { noise(t, 1.8, 0.8 * v, 'lowpass', 500, 0.7, null, 80); osc('sine', 55, t, 1.5, 0.5 * v, null, 30); for (let i = 0; i < 6; i++) noise(t + Math.random() * 0.8, 0.12, 0.3 * v, 'bandpass', 600 + Math.random() * 1200, 2); },
    death: (t, v) => { noise(t, 0.18, 0.18 * v, 'lowpass', 700, 1); osc('sawtooth', 240, t, 0.2, 0.04 * v, null, 120); },
    stone: (t, v) => { osc('sine', 80, t, 0.4, 0.5 * v, null, 40); noise(t, 0.35, 0.5 * v, 'lowpass', 700, 1); },
    launch: (t, v) => { noise(t, 0.3, 0.3 * v, 'bandpass', 400, 1, null, 1200); osc('sine', 70, t, 0.2, 0.4 * v); },
    done: (t, v) => { osc('triangle', 784, t, 0.25, 0.12 * v); osc('triangle', 1046, t + 0.12, 0.35, 0.12 * v); },
    place: (t, v) => { osc('sine', 300, t, 0.12, 0.3 * v, null, 150); noise(t, 0.08, 0.2 * v, 'lowpass', 1200, 1); },
    error: (t, v) => { osc('square', 180, t, 0.12, 0.06 * v); osc('square', 150, t + 0.1, 0.14, 0.06 * v); },
    fanfare: (t, v) => {
      const seq = [[392, 0, 0.18], [523, 0.18, 0.18], [659, 0.36, 0.18], [784, 0.54, 0.6], [659, 0.9, 0.16], [784, 1.06, 0.9]];
      for (const [f, d, l] of seq) {
        for (const m of [1, 1.005, 0.5]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = f * m; fl.type = 'lowpass'; fl.frequency.value = 2200;
          g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.09 * v, t + d + 0.04); g.gain.setValueAtTime(0.09 * v, t + d + l * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d + l);
          o.connect(fl); fl.connect(g); g.connect(sfx); o.start(t + d); o.stop(t + d + l + 0.05);
        }
      }
      noise(t + 0.54, 0.6, 0.12 * v, 'highpass', 5000, 1);
    },
    alarm: (t, v) => {
      for (let k = 0; k < 2; k++) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        const st = t + k * 0.55;
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = 233; o2.frequency.value = 349;
        lfo.frequency.value = 6; lg.gain.value = 5; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        fl.type = 'lowpass'; fl.frequency.value = 1400;
        g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.12 * v, st + 0.06); g.gain.setValueAtTime(0.12 * v, st + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
        o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(sfx);
        o.start(st); o2.start(st); lfo.start(st); o.stop(st + 0.55); o2.stop(st + 0.55); lfo.stop(st + 0.55);
      }
    },
    fall: (t, v) => { noise(t, 0.5, 0.25 * v, 'bandpass', 900, 3, null, 300); for (let i = 0; i < 4; i++) osc('triangle', 220 - i * 30, t + i * 0.08, 0.12, 0.05 * v); osc('sine', 70, t + 0.75, 0.35, 0.5 * v, null, 40); noise(t + 0.75, 0.3, 0.35 * v, 'lowpass', 600, 1); },
    thunder: (t, v) => { noise(t, 2.6, 0.9 * v, 'lowpass', 300, 0.7, null, 60); osc('sine', 48, t, 2.2, 0.6 * v, null, 30); for (let i = 0; i < 5; i++) noise(t + Math.random() * 0.6, 0.4, 0.4 * v, 'lowpass', 900, 1, null, 120); },
    roar: (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.9); f.type = 'lowpass'; f.frequency.value = 700; env(g, t, 0.08, 0.35 * v, 0.95); o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1.1); noise(t, 0.9, 0.35 * v, 'bandpass', 420, 1.2, null, 180); },
    growl: (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 85; l.frequency.value = 28; lg.gain.value = 22; l.connect(lg); lg.connect(o.frequency); env(g, t, 0.05, 0.22 * v, 0.6); o.connect(g); g.connect(sfx); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7); noise(t, 0.5, 0.15 * v, 'lowpass', 500, 1); },
    howl: (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(330, t); o.frequency.linearRampToValueAtTime(620, t + 0.35); o.frequency.linearRampToValueAtTime(560, t + 1.0); o.frequency.linearRampToValueAtTime(380, t + 1.4); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.2); g.gain.linearRampToValueAtTime(0.12 * v, t + 1.0); g.gain.linearRampToValueAtTime(0.0001, t + 1.45); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1.5); },
    rattle: (t, v) => { for (let i = 0; i < 7; i++) osc('square', 900 + Math.random() * 900, t + i * 0.045 + Math.random() * 0.02, 0.03, 0.07 * v); },
    cannon: (t, v) => { osc('sine', 110, t, 0.5, 0.8 * v, null, 32); noise(t, 0.35, 0.9 * v, 'lowpass', 1400, 0.8, null, 150); noise(t + 0.05, 0.9, 0.3 * v, 'lowpass', 400, 0.7, null, 80); },
    train: (t, v) => { osc('triangle', 523, t, 0.12, 0.1 * v); osc('triangle', 659, t + 0.08, 0.18, 0.1 * v); },
  };
  const MIN_GAP = { roar: 1.2, growl: 0.8, howl: 1.5, rattle: 0.4, cannon: 0.15, thunder: 1.5, fall: 0.3, chop: 0.12, mine: 0.12, hammer: 0.12, farm: 0.25, sword: 0.07, hit: 0.06, arrow: 0.06, gallop: 0.35, death: 0.08, stone: 0.1 };

  // world-positioned sound: attenuated by distance to camera focus
  function play(name, x, z, vol = 1) {
    if (!ctx || ctx.state !== 'running' || !SFX[name]) return;
    if (typeof Game !== 'undefined' && Game.mode === 'menu' && name !== 'click') return;
    let v = vol;
    if (x !== undefined) {
      const dx = x - Cam.x, dz = z - Cam.z; const d = Math.sqrt(dx * dx + dz * dz);
      const range = 14 + Cam.dist * 0.55;
      if (d > range) return;
      v *= clamp(1.15 - d / range, 0.08, 1) * clamp(30 / (Cam.dist + 8), 0.45, 1);
      if (Game.mode === 'play' && players[HUMAN] && players[HUMAN].vis[idx(clamp(x | 0, 0, N - 1), clamp(z | 0, 0, N - 1))] === 0) return;
    }
    const t = now();
    const gap = MIN_GAP[name] || 0.03;
    if (last[name] && t - last[name] < gap) return;
    last[name] = t;
    try { SFX[name](t + 0.005, v); } catch (e) { /* ignore audio glitches */ }
  }

  // ---------------- generative music ----------------
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [50, 53, 57], [52, 55, 59], [52, 56, 59]];
  const SCALE = [57, 59, 60, 62, 64, 67, 69, 72, 74, 76];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function pad(f, t, dur, vol) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = 900 + intensity * 900;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
      o.connect(fl); fl.connect(g); g.connect(music); o.start(t); o.stop(t + dur * 1.1);
    }
  }
  function pluck(f, t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(3000, t); fl.frequency.exponentialRampToValueAtTime(400, t + 0.6);
    env(g, t, 0.005, vol, 0.9); o.connect(fl); fl.connect(g); g.connect(music); o.start(t); o.stop(t + 1);
  }
  function drum(t, kind, vol) {
    if (kind === 'k') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25); env(g, t, 0.003, vol, 0.3); o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.35); }
    else if (kind === 't') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.2); env(g, t, 0.003, vol * 0.7, 0.22); o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.3); }
    else { noise(t, 0.12, vol * 0.5, 'bandpass', 1800, 0.8, music); }
  }
  function scheduleBar(t) {
    const fast = intensity > 0.35;
    const barLen = fast ? 2.2 : 3.2;
    const ch = CHORDS[bar % CHORDS.length];
    for (const m of ch) pad(mtof(m - 12), t, barLen, 0.05);
    pad(mtof(ch[0] - 24), t, barLen, 0.05);
    const steps = 8, st = barLen / steps;
    for (let i = 0; i < steps; i++) {
      if (Math.random() < (fast ? 0.55 : 0.28)) pluck(mtof(pick(SCALE) + (Math.random() < 0.2 ? 12 : 0)), t + i * st, 0.05);
      if (intensity > 0.2) {
        if (i % 4 === 0) drum(t + i * st, 'k', 0.28 * intensity);
        if (i % 4 === 2 && intensity > 0.45) drum(t + i * st, 's', 0.35 * intensity);
        if (fast && i % 2 === 1 && Math.random() < 0.5) drum(t + i * st, 't', 0.25 * intensity);
      }
    }
    bar++;
    return barLen;
  }
  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true; nextBar = now() + 0.2;
    schedTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      intensity += (targetIntensity - intensity) * 0.15;
      targetIntensity *= 0.9;
      while (nextBar < now() + 0.6) nextBar += scheduleBar(nextBar);
    }, 250);
  }
  // continuous rain bed (filtered noise), louder in storms
  let rainSrc = null, rainGain = null, rainLvl = 0;
  function setRain(amount, storm) {
    if (!ctx || ctx.state !== 'running') return;
    const target = Game.mode === 'loading' ? 0 : amount * 0.16 + storm * 0.08;
    if (!rainSrc && target > 0.005) {
      rainSrc = ctx.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.5;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      rainSrc.connect(f); f.connect(rainGain); rainGain.connect(sfx); rainSrc.start();
    }
    if (rainGain) { rainLvl += (target - rainLvl) * 0.05; rainGain.gain.value = rainLvl; }
  }
  function battle(amount) { targetIntensity = Math.min(1, targetIntensity + amount); }
  return { init, play, applyVolume, startMusic, battle, setRain, get ready() { return !!ctx; } };
})();
