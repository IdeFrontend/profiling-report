import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEFAULT_HTML_EXPORT_TEMPLATE_URL, HTML_EXPORT_B64_PLACEHOLDER } from '../../src/export/stitchHtmlReport';

test('PR-SCAFFOLD-004: playground loads ProfilingReport placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('playground-ready')).toBeVisible();
  await expect(page.getByTestId('profiling-report')).toBeVisible();
});

test('PR-E2E-017: playground Export downloads a stitched HTML report', async ({ page }) => {
  test.setTimeout(120_000);
  const templateRes = await page.request.get(DEFAULT_HTML_EXPORT_TEMPLATE_URL);
  expect(templateRes.ok(), `template HTTP ${templateRes.status()}`).toBe(true);
  const template = await templateRes.text();
  expect(template).toContain('<!-- __NPU_REP_EMBED_START__ -->');
  expect(template).toContain(HTML_EXPORT_B64_PLACEHOLDER);

  await page.goto('/');
  await expect(page.getByTestId('playground-ready')).toBeVisible();
  const exportBtn = page.getByTestId('export-html');
  await expect(exportBtn).toBeVisible({ timeout: 30_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
  await exportBtn.click();
  let download;
  try {
    download = await downloadPromise;
  } catch (cause) {
    const errText = await page.getByTestId('html-export-error').textContent().catch(() => null);
    throw new Error(errText || (cause instanceof Error ? cause.message : String(cause)));
  }
  expect(download.suggestedFilename()).toMatch(/\.html$/);
  const saved = await download.path();
  expect(saved).toBeTruthy();
  const html = readFileSync(saved!, 'utf8');
  expect(html).toContain('id="app"');
  expect(html).toMatch(/window\.__NPU_REP_B64__ = '[A-Za-z0-9+/]+=*'/);
  expect(html).not.toContain(`window.__NPU_REP_B64__ = '${HTML_EXPORT_B64_PLACEHOLDER}'`);
});
