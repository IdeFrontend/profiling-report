<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { ProfilingReport } from '../src/index';

declare global {
  interface Window {
    __NPU_REP_B64__?: string;
    __NPU_REP_NAME__?: string;
  }
}

const error = shallowRef<string | null>(null);
const source = shallowRef<ArrayBuffer | undefined>(undefined);

const reportName = computed(() => {
  const raw = window.__NPU_REP_NAME__;
  if (!raw) return 'report.npu-rep';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
  const b64 = window.__NPU_REP_B64__;
  // Unfilled template keeps a %%…%% sentinel; generate replaces only inside the embed block.
  if (!b64 || b64.startsWith('%%')) {
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
      locale="zh-CN"
    />
    <p
      v-else
      class="report-shell__loading"
      data-testid="report-shell-loading"
    >
      Loading…
    </p>
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
</style>
