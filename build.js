// Bundles src/*.js into a single self-contained ironvale.html
// usage: node build.js
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const files = fs.readdirSync(src).filter(f => /^\d+_.*\.js$/.test(f)).sort();
const js = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const shell = fs.readFileSync(path.join(src, 'shell.html'), 'utf8');
const out = shell.replace('/*__GAME_JS__*/', () => js);
fs.writeFileSync(path.join(__dirname, 'ironvale.html'), out);
const chk = path.join(require('os').tmpdir(), 'ironvale-bundle-check.js');
fs.writeFileSync(chk, js);
try { require('child_process').execFileSync(process.execPath, ['--check', chk], { stdio: 'inherit' }); console.log('syntax OK'); } catch (e) { console.error('SYNTAX ERROR'); process.exit(1); }
console.log(`ironvale.html written (${(out.length / 1024).toFixed(1)} KB, ${files.length} modules, models in ./models)`);
