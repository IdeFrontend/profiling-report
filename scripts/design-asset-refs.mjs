// Rewrite asset references in shipped design files.
//
// index.html keeps the stock export's quoting: single-quoted url() values are
// entity-escaped (`url(&#39;assets/x.png&#39;)`), while arkUIDSL.json stores plain
// JSON strings. A rewrite that only matches the raw spelling leaves the page
// pointing at a file that was moved to _shared/assets, so every known spelling
// is replaced here in one place.
const ENTITY_QUOTES = ['&#39;', '&#x27;', '&quot;', '&#34;'];

export function rewriteAssetRefs(text, name, target) {
  const pairs = [
    [`"src":"assets/${name}"`, `"src":"${target}"`],
    [`"src": "assets/${name}"`, `"src": "${target}"`],
    [`src="assets/${name}"`, `src="${target}"`],
    [`src='assets/${name}'`, `src='${target}'`],
    [`url(assets/${name})`, `url(${target})`],
    [`url('assets/${name}')`, `url('${target}')`],
    [`url("assets/${name}")`, `url("${target}")`],
  ];
  for (const q of ENTITY_QUOTES) {
    pairs.push(
      [`url(${q}assets/${name}${q})`, `url(${q}${target}${q})`],
      [`src=${q}assets/${name}${q}`, `src=${q}${target}${q}`],
    );
  }
  let out = text;
  for (const [from, to] of pairs) out = out.split(from).join(to);
  return out;
}
