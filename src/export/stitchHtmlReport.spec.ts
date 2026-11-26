import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HTML_EXPORT_B64_PLACEHOLDER,
  HTML_EXPORT_EMBED_START,
  htmlExportFileName,
  sourceWorkspaceFromTexts,
  stitchHtmlReport,
} from './stitchHtmlReport';
import {
  MISSING_SOURCE_EMBED_PREFIX,
  resolveMissingSourceFiles,
  workspaceSourceResolver,
} from '../adapters/sourceCorrelation/resolveSourceFile';
import type { SourceCorrelationModel } from '../domain/types';

const TEMPLATE = `<!doctype html>
<html lang="zh-CN"><head><title>profiling-report</title></head>
<body>
<div id="app"></div>
<!-- __NPU_REP_EMBED_START__ -->
<script>
  window.__NPU_REP_B64__ = '__HTML_EXPORT_B64__';
  window.__NPU_REP_NAME__ = '__HTML_EXPORT_NAME__';
  window.__NPU_REP_LOCALE__ = '__HTML_EXPORT_LOCALE__';
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
    expect(html).toContain("window.__NPU_REP_LOCALE__ = 'zh-CN'");
    expect(html).toContain('<title>op.npu-rep</title>');
    // Viewer bundle (and this helper) mention the token; only the embed slot is filled.
    expect(html).toContain("const keep = '__HTML_EXPORT_B64__'");
    expect(html).not.toContain(`window.__NPU_REP_B64__ = '${HTML_EXPORT_B64_PLACEHOLDER}'`);
  });

  it('carries resolved source text before the embed block and escapes markup', () => {
    const html = stitchHtmlReport(TEMPLATE, new Uint8Array([1]), 'op.npu-rep', 'en', {
      'kernel.asc': 'if (a < b && c > d) {\n  run();\n}',
      'sep.asc': 'x\u2028y\u2029z',
    });
    expect(html).toContain(
      '<script>window.__NPU_SOURCE_TEXTS__ = {"kernel.asc":"if (a \\u003c b \\u0026\\u0026 c \\u003e d) {\\n  run();\\n}","sep.asc":"x\\u2028y\\u2029z"};</script>',
    );
    const scriptAt = html.indexOf('window.__NPU_SOURCE_TEXTS__');
    expect(scriptAt).toBeLessThan(html.indexOf(HTML_EXPORT_EMBED_START));
    expect(scriptAt).toBeLessThan(html.indexOf('window.__NPU_REP_B64__'));
  });

  it('omits the source text script when the map is empty', () => {
    expect(stitchHtmlReport(TEMPLATE, new Uint8Array([1]), 'op.npu-rep')).not.toContain(
      '__NPU_SOURCE_TEXTS__',
    );
    expect(
      stitchHtmlReport(TEMPLATE, new Uint8Array([1]), 'op.npu-rep', 'en', {}),
    ).not.toContain('__NPU_SOURCE_TEXTS__');
  });

  it('round-trips the stitched map into a resolver that fills a placeholder model', async () => {
    const html = stitchHtmlReport(TEMPLATE, new Uint8Array([1]), 'op.npu-rep', 'en', {
      '/sdk/kernel.asc': 'int kernel() { return 0; }\n',
    });
    const embedded = /window\.__NPU_SOURCE_TEXTS__ = (.*?);<\/script>/.exec(html);
    expect(embedded).not.toBeNull();
    const texts = JSON.parse(embedded![1]!) as Record<string, string>;
    const pick = sourceWorkspaceFromTexts(texts)!;
    const model: SourceCorrelationModel = {
      files: [
        {
          id: '7',
          path: '/sdk/kernel.asc',
          language: 'ascend-c',
          text: `${MISSING_SOURCE_EMBED_PREFIX}/sdk/kernel.asc\n`,
          metricsColumns: [],
          lines: [],
        },
      ],
      assembly: { id: 'sass', path: 'k.sass', text: '', metricsColumns: [], lines: [] },
      asmToSource: new Map(),
      navigateBy: [],
      mock: false,
    };
    const filled = await resolveMissingSourceFiles(model, workspaceSourceResolver(pick));
    expect(filled.files[0]!.text).toBe('int kernel() { return 0; }\n');
    expect(sourceWorkspaceFromTexts({})).toBeNull();
  });

  it('uses the HTML <script> slot when the viewer bundle quotes the same markers first', () => {
    const bundled = `<script>const a='<!-- __NPU_REP_EMBED_START__ -->';const b='<!-- __NPU_REP_EMBED_END__ -->';const p='__HTML_EXPORT_B64__';</script>
${TEMPLATE}`;
    const html = stitchHtmlReport(bundled, new Uint8Array([1, 2, 3, 4]), 'op.npu-rep');
    expect(html).toContain("window.__NPU_REP_B64__ = 'AQIDBA=='");
    expect(html).toContain("const a='<!-- __NPU_REP_EMBED_START__ -->'");
    expect(html).toContain("const p='__HTML_EXPORT_B64__'");
  });

  it('writes the requested locale into the embed slot and html lang', () => {
    const html = stitchHtmlReport(TEMPLATE, new Uint8Array([1]), 'op.npu-rep', 'en-US');
    expect(html).toContain("window.__NPU_REP_LOCALE__ = 'en'");
    expect(html).toMatch(/<html[^>]*\blang="en"/);
    expect(html).not.toContain('__HTML_EXPORT_LOCALE__');
  });

  it('does not rewrite lang= attributes outside the html tag', () => {
    const withInner = TEMPLATE.replace(
      '</body>',
      '<p lang="zh-CN">keep</p></body>',
    );
    const html = stitchHtmlReport(withInner, new Uint8Array([1]), 'op.npu-rep', 'en');
    expect(html).toMatch(/<html[^>]*\blang="en"/);
    expect(html).toContain('<p lang="zh-CN">keep</p>');
  });

  it('throws when the embed block is missing', () => {
    expect(() => stitchHtmlReport('<html></html>', new Uint8Array([1]), 'x')).toThrow(
      /embed markers/,
    );
  });

  it('stitches the built report-shell template (JS marker strings appear first)', () => {
    const path = resolve(import.meta.dirname, '../../dist/report-shell/template.html');
    if (!existsSync(path)) return;
    const raw = readFileSync(path, 'utf8');
    if (!raw.includes('__HTML_EXPORT_LOCALE__')) return;
    const html = stitchHtmlReport(raw, new Uint8Array([1, 2, 3, 4]), 'op.npu-rep');
    expect(html).toContain("window.__NPU_REP_B64__ = 'AQIDBA=='");
    expect(html).toContain("window.__NPU_REP_LOCALE__ = 'zh-CN'");
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
