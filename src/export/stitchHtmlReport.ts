/** Markers written into report-shell/index.html; the CLI / in-app export replace only this block. */
export const HTML_EXPORT_EMBED_START = '<!-- __NPU_REP_EMBED_START__ -->';
export const HTML_EXPORT_EMBED_END = '<!-- __NPU_REP_EMBED_END__ -->';
/** Must not use `%NAME%` — Vite HTML env replacement strips those tokens on `.html` fetches. */
export const HTML_EXPORT_B64_PLACEHOLDER = '__HTML_EXPORT_B64__';
export const HTML_EXPORT_NAME_PLACEHOLDER = '__HTML_EXPORT_NAME__';
export const HTML_EXPORT_LOCALE_PLACEHOLDER = '__HTML_EXPORT_LOCALE__';

/** Playground / host URL for the inlined report-shell template (copied at `build:report-shell`). */
export const DEFAULT_HTML_EXPORT_TEMPLATE_URL = '/npu-rep-html-template.txt';

export function htmlExportFileName(reportName: string): string {
  const base = reportName.replace(/\.(npu-rep|npu\.rep|rep|json)$/i, '');
  return `${base || 'report'}.html`;
}

/** Viewer locales. Unknown / omitted → zh-CN (same as `resolveLocale`). */
export function htmlExportLocale(locale?: string): 'en' | 'zh-CN' {
  if (!locale) return 'zh-CN';
  const lower = locale.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('zh')) return 'zh-CN';
  return 'zh-CN';
}

/**
 * Locate the HTML embed slot. The inlined viewer bundle also contains the marker
 * strings as JS constants — those are immediately followed by `'` / `;`, not `<script>`.
 */
export function findHtmlExportEmbed(template: string): { start: number; endExclusive: number } {
  const startTok = HTML_EXPORT_EMBED_START;
  const endTok = HTML_EXPORT_EMBED_END;
  let from = 0;
  while (from < template.length) {
    const start = template.indexOf(startTok, from);
    if (start < 0) break;
    const after = template.slice(start + startTok.length, start + startTok.length + 64);
    if (/^\s*<script[\s>]/.test(after)) {
      const end = template.indexOf(endTok, start + startTok.length);
      if (end < 0) break;
      return { start, endExclusive: end + endTok.length };
    }
    from = start + startTok.length;
  }
  throw new Error('shell template is missing embed markers');
}

/**
 * Embed report bytes into a prebuilt single-file shell template.
 * Replaces placeholders only inside the HTML embed block.
 */
export function stitchHtmlReport(
  template: string,
  reportBytes: Uint8Array,
  reportName: string,
  locale?: string,
): string {
  const b64 = uint8ToBase64(reportBytes);
  const nameEncoded = encodeURIComponent(reportName);
  const loc = htmlExportLocale(locale);
  const { start, endExclusive } = findHtmlExportEmbed(template);
  let embed = template.slice(start, endExclusive);
  if (!embed.includes(HTML_EXPORT_B64_PLACEHOLDER)) {
    throw new Error('shell template is missing __HTML_EXPORT_B64__ placeholder');
  }
  if (!embed.includes(HTML_EXPORT_LOCALE_PLACEHOLDER)) {
    throw new Error('shell template is missing __HTML_EXPORT_LOCALE__ placeholder');
  }
  embed = embed.split(HTML_EXPORT_B64_PLACEHOLDER).join(b64);
  embed = embed.split(HTML_EXPORT_NAME_PLACEHOLDER).join(nameEncoded);
  embed = embed.split(HTML_EXPORT_LOCALE_PLACEHOLDER).join(loc);
  let html = template.slice(0, start) + embed + template.slice(endExclusive);
  const title = reportName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  if (/\blang=/.test(html)) {
    html = html.replace(/\blang=(["'])[^"']*\1/, `lang="${loc}"`);
  } else {
    html = html.replace(/<html\b/i, `<html lang="${loc}"`);
  }
  return html;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
