const esbuild = require('esbuild');
const { readFileSync } = require('node:fs');

const file = 'src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.ts';
let raw = readFileSync(file, 'utf8');
// Find the last `it(` and remove the rest
const lastIt = raw.lastIndexOf('\n  it(');
const cut1 = lastIt;
let trial = raw.slice(0, cut1) + '\n});\n';
try {
  esbuild.transformSync(trial, { loader: 'ts' });
  console.log('OK without last it');
} catch (e) {
  console.log('still err:', e.errors[0].text, 'at line', e.errors[0].location.line);
  // If still err, the error is before the last it
  // Binary chop
  let lo = 0, hi = cut1;
  while (hi - lo > 200) {
    const mid = (lo + hi) / 2;
    let pos = raw.indexOf('\n  it(', mid);
    if (pos < 0) pos = mid;
    const t = raw.slice(0, pos) + '\n});\n';
    try {
      esbuild.transformSync(t, { loader: 'ts' });
      lo = pos;
    } catch {
      hi = pos;
    }
  }
  console.log('problem region starts at byte ~', lo);
  const lines = raw.slice(0, lo).split(/\r?\n/);
  for (let i = Math.max(0, lines.length-3); i < lines.length+2; i++) {
    console.log(`${i+1}: ${lines[i] || '<eof>'}`);
  }
}
