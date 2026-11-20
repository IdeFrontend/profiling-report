#!/usr/bin/env node
// Locate a UI element by name/text across all design screens.
//   npm run design:find -- <query...> [<designRoot>] [--screen <S>] [--word] [--json] [--limit N]
// Prints per screen: matched nodes with bbox, type, content, and the ancestor chain
// (so you immediately see the context, e.g. 报告统计 > 时钟周期 > … > "UB").
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = join(ROOT, 'docs/ui/source/1130');

const args = process.argv.slice(2);
const json = args.includes('--json');
const word = args.includes('--word');
const sIdx = args.indexOf('--screen');
const screenFilter = sIdx >= 0 ? args[sIdx + 1] : null;
const lIdx = args.indexOf('--limit');
const limit = lIdx >= 0 ? +args[lIdx + 1] : 40;
const positional = args.filter((a) => !a.startsWith('--') && a !== screenFilter && (lIdx < 0 || a !== args[lIdx + 1]));
// last positional is the design root when it is a directory; otherwise use the default
let root = DEFAULT_ROOT;
if (positional.length > 1 && existsSync(positional[positional.length - 1])) root = positional.pop();
const queries = positional;
if (!queries.length) {
  console.error('usage: npm run design:find -- <query...> [<designRoot>] [--screen <S>] [--word] [--json] [--limit N]');
  process.exit(2);
}
// --word: match the query as a whole word (so "UB" does not hit "CUBE").
const qs = queries.map((x) => x.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const res = qs.map((t) => (word ? new RegExp(`(^|[^\\p{L}\\p{N}])${t}($|[^\\p{L}\\p{N}])`, 'iu') : new RegExp(t, 'i')));

function walk(n, chain, hits) {
  if (!n || typeof n !== 'object') return;
  const m = n.meta || {};
  const hay = [
    m.octoName || '',
    n.componentName || '',
    typeof n.content === 'string' ? n.content : '',
    m.octoType || '',
  ].join('\n');
  if (res.every((re) => re.test(hay))) {
    hits.push({
      screen: screenFilter,
      chain: [...chain, m.octoName || n.componentName],
      name: m.octoName,
      type: n.componentName,
      bbox: m.bbox,
      content: typeof n.content === 'string' ? n.content : undefined,
      src: n.src,
      bg: (n.styles || {}).backgroundColor,
    });
  }
  for (const c of n.children || []) walk(c, [...chain, m.octoName || n.componentName], hits);
}

const results = [];
const screens = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && (!screenFilter || d.name === screenFilter))
  .map((d) => d.name);

for (const s of screens) {
  const p = join(root, s, 'arkUIDSL.json');
  if (!existsSync(p)) continue;
  const dsl = JSON.parse(readFileSync(p, 'utf-8'));
  const hits = [];
  walk(dsl.ui, [], hits);
  if (hits.length) results.push({ screen: s, hits: hits.slice(0, limit) });
}

if (json) {
  console.log(JSON.stringify(results, null, 1));
} else {
  let total = 0;
  for (const r of results) {
    console.log(`== ${r.screen} (${r.hits.length}${r.hits.length >= limit ? '+' : ''} hits)`);
    for (const h of r.hits) {
      const bb = h.bbox ? `[${h.bbox.map((v) => Math.round(v * 10) / 10).join(',')}]` : '[no bbox]';
      const ctx = h.chain.slice(0, -1).join(' > ');
      console.log(`  ${h.type || '?'} ${JSON.stringify(h.name)} ${bb}${h.content ? ' text=' + JSON.stringify(h.content.slice(0, 60)) : ''}${h.src ? ' src=' + h.src : ''}${h.bg ? ' bg=' + h.bg : ''}`);
      if (ctx) console.log(`      in: ${ctx}`);
    }
    total += r.hits.length;
  }
  console.log(`total: ${total} hits in ${results.length} screens`);
}
