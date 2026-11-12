'use strict';
// =====================================================================
//  I18N — minimal Korean/English layer (unofficial localization)
//  t(key): key is the original English text; ko dictionary maps it to Korean.
//  Static HTML, tooltips and dynamic text are translated at the DOM level
//  (text nodes + title/placeholder attributes); code strings stay English so
//  game logic that compares strings keeps working.
// =====================================================================
const I18N = (() => {
  const ko = Object.create(null), koAttr = Object.create(null), rules = [];
  const KEY = 'ironvale.lang';
  let lang = 'ko';
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'ko') lang = v; } catch (e) { /* storage unavailable */ }
  const norm = s => s.replace(/\s+/g, ' ').trim();
  function tr(s, isAttr) {
    if (lang !== 'ko' || !s) return s;
    const k = norm(s);
    if (isAttr && koAttr[k] !== undefined) return koAttr[k];
    if (ko[k] !== undefined) return ko[k];
    for (const [re, fn] of rules) { const m = re.exec(k); if (m) { const o = fn(m, tr); if (o != null) return o; } }
    return s;
  }
  const orig = new WeakMap(), origAttr = new WeakMap();
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  function txt(n) {
    const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return;
    const o = orig.get(n); if (o && o.out === v) return;
    const out = tr(v); if (out === v) return;
    const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    const nv = lead + out + trail; orig.set(n, { src: v, out: nv }); n.nodeValue = nv;
  }
  function attr(el, a) {
    const v = el.getAttribute(a); if (!v || !/[A-Za-z]/.test(v)) return;
    let m = origAttr.get(el); const o = m && m[a]; if (o && o.out === v) return;
    const out = tr(v, true); if (out === v) return;
    if (!m) origAttr.set(el, m = {}); m[a] = { src: v, out }; el.setAttribute(a, out);
  }
  function walk(root) {
    if (root.nodeType === 3) return txt(root);
    if (root.nodeType !== 1) return;
    if (/^(SCRIPT|STYLE|CANVAS)$/.test(root.tagName)) return;
    for (const a of ATTRS) if (root.hasAttribute(a)) attr(root, a);
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function restore(root) {
    if (root.nodeType === 3) { const o = orig.get(root); if (o && o.out === root.nodeValue) { root.nodeValue = o.src; orig.delete(root); } return; }
    if (root.nodeType !== 1) return;
    const m = origAttr.get(root);
    if (m) for (const a in m) if (root.getAttribute(a) === m[a].out) root.setAttribute(a, m[a].src);
    origAttr.delete(root);
    for (let c = root.firstChild; c; c = c.nextSibling) restore(c);
  }
  let mo = null;
  function observe() {
    if (mo || typeof MutationObserver === 'undefined') return;
    mo = new MutationObserver(recs => {
      if (lang !== 'ko') return;
      for (const r of recs) {
        if (r.type === 'characterData') txt(r.target);
        else if (r.type === 'attributes') attr(r.target, r.attributeName);
        else for (const n of r.addedNodes) walk(n);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function sync() {
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle('ko', lang === 'ko');
    document.title = lang === 'ko' ? '아이언베일 (한글화)' : 'Ironvale';
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    const lb = document.getElementById('btnLang'); if (lb) lb.textContent = lang === 'ko' ? 'English' : '한국어';
  }
  function set(l) {
    if (l !== 'ko' && l !== 'en') return;
    lang = l; try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
    if (l === 'ko') walk(document.body); else restore(document.body);
    sync();
  }
  function start() {
    // language buttons: main menu toggle + settings row
    const lb = document.getElementById('btnLang'); if (lb) lb.onclick = () => set(lang === 'ko' ? 'en' : 'ko');
    document.querySelectorAll('[data-lang]').forEach(b => { b.onclick = () => set(b.dataset.lang); });
    sync(); observe();
    if (lang === 'ko') walk(document.body);
  }
  return { t: tr, set, get lang() { return lang; }, add(d) { Object.assign(ko, d); }, addAttr(d) { Object.assign(koAttr, d); }, rule(re, fn) { rules.push([re, fn]); }, start };
})();
function t(s) { return I18N.t(s); }
