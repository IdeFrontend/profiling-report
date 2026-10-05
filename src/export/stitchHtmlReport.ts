/** Markers written into report-shell/index.html; the CLI / in-app export replace only this block. */
export const HTML_EXPORT_EMBED_START = '<!-- __NPU_REP_EMBED_START__ -->';
export const HTML_EXPORT_EMBED_END = '<!-- __NPU_REP_EMBED_END__ -->';
export const HTML_EXPORT_B64_PLACEHOLDER = '%%NPU_REP_B64%%';
export const HTML_EXPORT_NAME_PLACEHOLDER = '%%NPU_REP_NAME%%';

/** Playground / host URL for the inlined report-shell template (copied at `build:report-shell`). */
export const DEFAULT_HTML_EXPORT_TEMPLATE_URL = '/npu-rep-html-template.html';

export function htmlExportFileName(reportName: string): string {
  const base = reportName.replace(/\.(npu-rep|npu\.rep|rep|json)$/i, '');
  return `${base || 'report'}.html`;
}

/**
 * Embed report bytes into a prebuilt single-file shell template.
 * Replaces placeholders only inside the embed block: the inlined viewer bundle
 * also contains these token strings (stitch helper constants), so a whole-file
 * replace would corrupt it.
 */
export function stitchHtmlReport(
  template: string,
  reportBytes: Uint8Array,
  reportName: string,
): string {
  const b64 = uint8ToBase64(reportBytes);
  const nameEncoded = encodeURIComponent(reportName);
  const start = template.indexOf(HTML_EXPORT_EMBED_START);
  const end = template.indexOf(HTML_EXPORT_EMBED_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('shell template is missing embed markers');
  }
  let embed = template.slice(start, end + HTML_EXPORT_EMBED_END.length);
  if (!embed.includes(HTML_EXPORT_B64_PLACEHOLDER)) {
    throw new Error('shell template is missing %%NPU_REP_B64%% placeholder');
  }
  embed = embed.split(HTML_EXPORT_B64_PLACEHOLDER).join(b64);
  embed = embed.split(HTML_EXPORT_NAME_PLACEHOLDER).join(nameEncoded);
  let html = template.slice(0, start) + embed + template.slice(end + HTML_EXPORT_EMBED_END.length);
  const title = reportName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
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
