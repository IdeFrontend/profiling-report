/** Node stitch for generate-html-report / packed npu-rep-html. Keep in lockstep with src/export/stitchHtmlReport.ts. */

export const HTML_EXPORT_EMBED_START = '<!-- __NPU_REP_EMBED_START__ -->';
export const HTML_EXPORT_EMBED_END = '<!-- __NPU_REP_EMBED_END__ -->';
export const HTML_EXPORT_B64_PLACEHOLDER = '__HTML_EXPORT_B64__';
export const HTML_EXPORT_NAME_PLACEHOLDER = '__HTML_EXPORT_NAME__';
export const HTML_EXPORT_LOCALE_PLACEHOLDER = '__HTML_EXPORT_LOCALE__';

export function htmlExportLocale(locale) {
  if (!locale) return 'zh-CN';
  const lower = String(locale).toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('zh')) return 'zh-CN';
  return 'zh-CN';
}

export function findHtmlExportEmbed(template) {
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

export function stitchHtmlReport(template, reportBytes, reportName, locale) {
  const b64 = Buffer.from(reportBytes).toString('base64');
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
  if (/<html\b[^>]*\blang=/i.test(html)) {
    html = html.replace(/<html\b([^>]*)\blang=(["'])[^"']*\2/i, `<html$1lang="${loc}"`);
  } else {
    html = html.replace(/<html\b/i, `<html lang="${loc}"`);
  }
  return html;
}
