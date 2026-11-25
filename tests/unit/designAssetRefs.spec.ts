import { describe, expect, it } from 'vitest';
import { rewriteAssetRefs } from '../../scripts/design-asset-refs.mjs';

const TARGET = '../_shared/assets/a.png';

describe('rewriteAssetRefs', () => {
  it('rewrites JSON and every HTML quoting/entity spelling', () => {
    const forms = [
      '"src":"assets/a.png"',
      '"src": "assets/a.png"',
      'src="assets/a.png"',
      "src='assets/a.png'",
      'url(assets/a.png)',
      "url('assets/a.png')",
      'url("assets/a.png")',
      'url(&#39;assets/a.png&#39;)',
      'url(&#x27;assets/a.png&#x27;)',
      'url(&quot;assets/a.png&quot;)',
      'url(&#34;assets/a.png&#34;)',
      'src=&#39;assets/a.png&#39;',
    ];
    for (const input of forms) {
      expect(rewriteAssetRefs(input, 'a.png', TARGET)).toBe(input.split('assets/a.png').join(TARGET));
    }
  });

  it('rewrites the shipped single-quoted entity form', () => {
    const html = '<div style="background-image:url(&#39;assets/a.png&#39;)"></div>';
    expect(rewriteAssetRefs(html, 'a.png', TARGET)).toBe(
      `<div style="background-image:url(&#39;${TARGET}&#39;)"></div>`,
    );
  });

  it('does not rewrite a longer name that merely contains the ref', () => {
    expect(rewriteAssetRefs('url(assets/a.png.bak)', 'a.png', TARGET)).toBe('url(assets/a.png.bak)');
    expect(rewriteAssetRefs('"src":"assets/aa.png"', 'a.png', TARGET)).toBe('"src":"assets/aa.png"');
  });
});
