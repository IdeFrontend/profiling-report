<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { ProfilingReport } from '../src/index';
import { HTML_EXPORT_B64_PLACEHOLDER, HTML_EXPORT_LOCALE_PLACEHOLDER, htmlExportLocale } from '../src/export/stitchHtmlReport';
import { createBaselinesHost } from '../src/host/baselinesHost';

declare global {
  interface Window {
    __NPU_REP_B64__?: string;
    __NPU_REP_NAME__?: string;
    __NPU_REP_LOCALE__?: string;
  }
}

const error = shallowRef<string | null>(null);
const source = shallowRef<ArrayBuffer | undefined>(undefined);

/**
 * Baselines (对比基线) — the exported HTML is a host too: shared host glue
 * lives in `src/host/baselinesHost.ts` (session-only state + hidden
 * file input), so the offline artifact keeps the control and cannot drift
 * from the playground twin.
 */
const baselineInputRef = ref<HTMLInputElement | null>(null);
const {
  baselines,
  selectedBaselineId,
  selectedBaselineOperator,
  pickBaselineFile,
  onBaselinesUpdate,
  onSelectedBaselineId,
  onSelectedBaselineOperator,
  onFileChosen: onBaselineFileChosen,
  onPickCancel: onBaselinePickCancel,
} = createBaselinesHost(() => baselineInputRef.value);

const reportName = computed(() => {
  const raw = window.__NPU_REP_NAME__;
  if (!raw) return 'report.npu-rep';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
});

const locale = computed(() => {
  const raw = window.__NPU_REP_LOCALE__;
  if (!raw || raw === HTML_EXPORT_LOCALE_PLACEHOLDER) return htmlExportLocale();
  return htmlExportLocale(raw);
});

const reportMeta = computed(() => ({
  name: reportName.value,
  id: reportName.value,
  path: reportName.value,
  collectedAt: new Date().toISOString(),
}));

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

onMounted(() => {
  document.documentElement.lang = locale.value;
  const b64 = window.__NPU_REP_B64__;
  if (!b64 || b64 === HTML_EXPORT_B64_PLACEHOLDER) {
    error.value =
      'No report embedded. Run: npm run generate:html-report -- <file.npu-rep> -o out.html';
    return;
  }
  try {
    source.value = b64ToArrayBuffer(b64);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <main class="report-shell">
    <p
      v-if="error"
      class="report-shell__error"
      data-testid="report-shell-error"
    >
      {{ error }}
    </p>
    <ProfilingReport
      v-else-if="source"
      :title="reportName"
      :source="source"
      :report-meta="reportMeta"
      :locale="locale"
      :allow-html-export="false"
      :baselines="baselines"
      :selected-baseline-id="selectedBaselineId"
      :selected-baseline-operator="selectedBaselineOperator"
      :pick-baseline-file="pickBaselineFile"
      :recent-baselines="[]"
      @update:baselines="onBaselinesUpdate"
      @update:selected-baseline-id="onSelectedBaselineId"
      @update:selected-baseline-operator="onSelectedBaselineOperator"
    />
    <p
      v-else
      class="report-shell__loading"
      data-testid="report-shell-loading"
    >
      Loading…
    </p>
    <!-- Last child on purpose: anything between ProfilingReport and the
         v-else paragraph would break the v-if / v-else-if / v-else chain. -->
    <input
      ref="baselineInputRef"
      class="report-shell__file"
      type="file"
      accept=".rep,.ncrep,.npu-rep,.json"
      data-testid="baseline-file-input"
      @change="onBaselineFileChosen"
      @cancel="onBaselinePickCancel"
    >
  </main>
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  background: #1f1f1f;
  color: #ddd;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.report-shell {
  box-sizing: border-box;
  height: 100vh;
  width: 100%;
}

.report-shell__error {
  margin: 24px;
  color: #f87171;
  white-space: pre-wrap;
}

.report-shell__loading {
  margin: 24px;
  opacity: 0.7;
}

.report-shell__file {
  display: none;
}
</style>
