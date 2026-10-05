import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HTML_EXPORT_B64_PLACEHOLDER,
  htmlExportFileName,
  stitchHtmlReport,
} from './stitchHtmlReport';

const TEMPLATE = `<!doctype html>
<html><head><title>profiling-report</title></head>
<body>
<div id="app"></div>
<!-- __NPU_REP_EMBED_START__ -->
<script>
  window.__NPU_REP_B64__ = '__HTML_EXPORT_B64__';
  window.__NPU_REP_NAME__ = '__HTML_EXPORT_NAME__';
</script>
<!-- __NPU_REP_EMBED_END__ -->
<script type="module">const keep = '__HTML_EXPORT_B64__';</script>
</body></html>`;

describe('stitchHtmlReport', () => {
  it('replaces embed placeholders and title; leaves tokens outside the block', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const html = stitchHtmlReport(TEMPLATE, bytes, 'op.npu-rep');
    expect(html).toContain("window.__NPU_REP_B64__ = 'AQIDBA=='");
    expect(html).toContain("window.__NPU_REP_NAME__ = 'op.npu-rep'");
    expect(html).toContain('<title>op.npu-rep</title>');
    // Viewer bundle (and this helper) mention the token; only the embed slot is filled.
    expect(html).toContain("const keep = '__HTML_EXPORT_B64__'");
    expect(html).not.toContain(`window.__NPU_REP_B64__ = '${HTML_EXPORT_B64_PLACEHOLDER}'`);
  });

  it('uses the HTML <script> slot when the viewer bundle quotes the same markers first', () => {
    const bundled = `<script>const a='<!-- __NPU_REP_EMBED_START__ -->';const b='<!-- __NPU_REP_EMBED_END__ -->';const p='__HTML_EXPORT_B64__';</script>
${TEMPLATE}`;
    const html = stitchHtmlReport(bundled, new Uint8Array([1, 2, 3, 4]), 'op.npu-rep');
    expect(html).toContain("window.__NPU_REP_B64__ = 'AQIDBA=='");
    expect(html).toContain("const a='<!-- __NPU_REP_EMBED_START__ -->'");
    expect(html).toContain("const p='__HTML_EXPORT_B64__'");
  });

  it('throws when the embed block is missing', () => {
    expect(() => stitchHtmlReport('<html></html>', new Uint8Array([1]), 'x')).toThrow(
      /embed markers/,
    );
  });

  it('stitches the built report-shell template (JS marker strings appear first)', () => {
    const path = resolve(import.meta.dirname, '../../dist/report-shell/template.html');
    if (!existsSync(path)) return;
    const html = stitchHtmlReport(readFileSync(path, 'utf8'), new Uint8Array([1, 2, 3, 4]), 'op.npu-rep');
    expect(html).toContain("window.__NPU_REP_B64__ = 'AQIDBA=='");
    expect(html).not.toContain(`window.__NPU_REP_B64__ = '${HTML_EXPORT_B64_PLACEHOLDER}'`);
  });

  it('throws when Vite-style %ENV% stripping emptied the embed placeholder', () => {
    const eaten = TEMPLATE.replaceAll('__HTML_EXPORT_B64__', '%%').replaceAll(
      '__HTML_EXPORT_NAME__',
      '%%',
    );
    expect(() => stitchHtmlReport(eaten, new Uint8Array([1]), 'x')).toThrow(
      /__HTML_EXPORT_B64__ placeholder/,
    );
  });
});

describe('htmlExportFileName', () => {
  it('strips known report extensions', () => {
    expect(htmlExportFileName('vector_muladd_plain.npu-rep')).toBe('vector_muladd_plain.html');
    expect(htmlExportFileName('out.rep')).toBe('out.html');
    expect(htmlExportFileName('trace.json')).toBe('trace.html');
  });
});
