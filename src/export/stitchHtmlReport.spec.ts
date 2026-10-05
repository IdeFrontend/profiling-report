import { describe, expect, it } from 'vitest';
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
  window.__NPU_REP_B64__ = '%%NPU_REP_B64%%';
  window.__NPU_REP_NAME__ = '%%NPU_REP_NAME%%';
</script>
<!-- __NPU_REP_EMBED_END__ -->
<script type="module">const keep = '%%NPU_REP_B64%%';</script>
</body></html>`;

describe('stitchHtmlReport', () => {
  it('replaces embed placeholders and title; leaves tokens outside the block', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const html = stitchHtmlReport(TEMPLATE, bytes, 'op.npu-rep');
    expect(html).toContain("window.__NPU_REP_B64__ = 'AQIDBA=='");
    expect(html).toContain("window.__NPU_REP_NAME__ = 'op.npu-rep'");
    expect(html).toContain('<title>op.npu-rep</title>');
    // Viewer bundle (and this helper) mention the token; only the embed slot is filled.
    expect(html).toContain("const keep = '%%NPU_REP_B64%%'");
    expect(html).not.toContain(`window.__NPU_REP_B64__ = '${HTML_EXPORT_B64_PLACEHOLDER}'`);
  });

  it('throws when the embed block is missing', () => {
    expect(() => stitchHtmlReport('<html></html>', new Uint8Array([1]), 'x')).toThrow(
      /embed markers/,
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
