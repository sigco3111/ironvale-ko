// Lists English string fragments in src/*.js (UI templates, descriptions, tips) that the Korean dictionary does not translate.
// usage: node tools/check-i18n.js [file ...] [--all]   (exit 1 if untranslated fragments remain in the checked files)
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src');
const sandbox = { localStorage: { getItem: () => 'ko' }, document: { getElementById: () => null, querySelectorAll: () => [], documentElement: { classList: { toggle() {} } } }, MutationObserver: undefined, console };
vm.createContext(sandbox);
for (const f of fs.readdirSync(src).filter(f => /^00_i18n.*\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8').replace(/^const I18N/m, 'var I18N').replace(/^I18N\.start\(\);/m, '').replace(/^function t\(/m, 'var t = function('), sandbox, { filename: f });
const tr = s => sandbox.I18N.t(s);
const DEFAULT = ['01_core.js', '10_ui.js', '17_ui2.js', '15_extras.js'];
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const files = args.length ? args : DEFAULT;
function literals(code) { // string/template literals (skips comments & regexes roughly)
  const out = []; let i = 0;
  while (i < code.length) {
    const c = code[i], n = code[i + 1];
    if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = code.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { let j = i + 1, s = ''; while (j < code.length && code[j] !== c) { if (code[j] === '\\') { s += code[j + 1]; j += 2; } else s += code[j++]; } out.push(s); i = j + 1; continue; }
    if (c === '`') { // template: split at ${ } with nesting
      let j = i + 1, cur = ''; const parts = [];
      while (j < code.length && code[j] !== '`') {
        if (code[j] === '\\') { cur += code[j + 1]; j += 2; }
        else if (code[j] === '$' && code[j + 1] === '{') { parts.push(cur); cur = ''; let d = 1; j += 2; const st = j; while (j < code.length && d) { if (code[j] === '{') d++; else if (code[j] === '}') d--; j++; } out.push(...literals(code.slice(st, j - 1))); }
        else cur += code[j++];
      }
      parts.push(cur); out.push(...parts); i = j + 1; continue;
    }
    i++;
  }
  return out;
}
// string pieces that are concatenated at runtime or are logic keys, not display text (the composed result is covered by rules)
const IGNORE = new Set(['ON', 'OFF', 'Queue', 'Age', 'rad)', '(researching)', '+25% HP, +1 armor, +20% production speed', ', +1 arrow and range', ', +2 population', 'villagers gathering, +', '(+300 food, +300 gold)', '(+150 food, +150 wood)', 'WASDQEPM']);
let bad = 0;
for (const f of files) {
  const seen = new Set(), miss = [];
  for (const lit of literals(fs.readFileSync(path.join(src, f), 'utf8'))) {
    if (/[A-Za-z]{2}/.test(lit) && tr(lit) !== lit) continue; // whole literal (e.g. a tip with markup) is a dictionary key
    for (const frag of lit.split(/<[^>]*>|&[a-z]+;/)) {
      const s = frag.replace(/\s+/g, ' ').trim();
      if (!/[A-Za-z]{2}/.test(s) || seen.has(s)) continue; seen.add(s);
      if (/^[#.\[<"]|px|url\(|data-|style=|class=|^[a-z]+[A-Z]|^\w+\(/.test(s) || /[\s(,:·"]$/.test(frag) && !/[.!?]$/.test(s)) continue; // css/markup bits and string pieces that are concatenated at runtime (covered by rules, verified in the browser)
      if (/^[a-z][a-zA-Z0-9_.\-]*$/.test(s) || /^[#.\-a-z]+[:;{(]/.test(s) || /^(rgba?|url|translate|rotate|linear|radial|M\d)/.test(s) || /^[\w.-]+( [\w.-]+)*$/.test(s) && !/^[A-Z]/.test(s)) continue; // identifiers, css, single lowercase words
      if (tr(s) === s && !IGNORE.has(s)) miss.push(s);
    }
  }
  console.log(`${f}: ${miss.length} untranslated fragment(s)`); miss.forEach(m => console.log('  - ' + m)); bad += miss.length;
}
process.exit(bad ? 1 : 0);
