<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import {
  ProfilingReport,
  workspaceSourceResolver,
} from '../src/index';
import {
  HTML_EXPORT_B64_PLACEHOLDER,
  HTML_EXPORT_LOCALE_PLACEHOLDER,
  htmlExportLocale,
  sourceWorkspaceFromTexts,
} from '../src/export/stitchHtmlReport';
import {
  createBaselinesHost,
  withDemoBaselineOperators,
} from '../src/host/baselinesHost';

declare global {
  interface Window {
    __NPU_REP_B64__?: string;
    __NPU_REP_NAME__?: string;
    __NPU_REP_LOCALE__?: string;
    __NPU_SOURCE_TEXTS__?: Record<string, string>;
  }
}

const error = shallowRef<string | null>(null);
const source = shallowRef<ArrayBuffer | undefined>(undefined);

/** Source text the exporting host resolved (keyed by file id) rides in the HTML. */
const sourceWorkspace = computed(() => sourceWorkspaceFromTexts(window.__NPU_SOURCE_TEXTS__));
const resolveSourceFile = computed(() => {
  const pick = sourceWorkspace.value;
  return pick ? workspaceSourceResolver(pick) : undefined;
});

/**
 * Baselines (对比基线) — the exported HTML is a host too: shared host glue
 * lives in `src/host/baselinesHost.ts` (session-only state + hidden
 * file input), so the offline artifact keeps the control and cannot drift
 * from the playground twin. It deliberately passes no `recentBaselines`: the
 * demo list's `/data/*.rep` fixtures do not exist inside a single-file
 * artifact, so those rows could never adapt — the picker offers Browse only.
 */
const baselineInputRef = ref<HTMLInputElement | null>(null);
const {
  baselines,
  baselineRows,
  baselineReports,
  pickBaselineFile,
  onBaselinesUpdate,
  onBaselineRows,
  onFileChosen: onBaselineFileChosen,
  onPickCancel: onBaselinePickCancel,
} = createBaselinesHost(() => baselineInputRef.value);

/** Every entry carries demo operators the way MSTT would pass the pack's real ones. */
const viewerBaselines = computed(() => withDemoBaselineOperators(baselines.value));

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
      :resolve-source-file="resolveSourceFile"
      :baselines="viewerBaselines"
      :baseline-rows="baselineRows"
      :pick-baseline-file="pickBaselineFile"
      :baseline-reports="baselineReports"
      @update:baselines="onBaselinesUpdate"
      @update:baseline-rows="onBaselineRows"
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
