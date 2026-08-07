<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { ProfilingReport } from '../src/index';

const status = ref('loading');
const source = shallowRef<ArrayBuffer | undefined>(undefined);
const error = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const openedName = ref<string | null>(null);
const loadToken = ref(0);

const queryFixture = computed((): 'rep' | 'trace' => {
  if (typeof window === 'undefined') return 'rep';
  return new URLSearchParams(window.location.search).get('fixture') === 'trace'
    ? 'trace'
    : 'rep';
});

const title = computed(() => {
  if (openedName.value) return openedName.value;
  return queryFixture.value === 'trace' ? 'out.trace.json' : 'out.rep';
});

async function loadUrl(url: string): Promise<void> {
  status.value = 'loading';
  error.value = null;
  source.value = undefined;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  source.value = await res.arrayBuffer();
  loadToken.value += 1;
  status.value = 'ready';
}

async function loadFixture(kind: 'rep' | 'trace'): Promise<void> {
  openedName.value = null;
  const url = kind === 'trace' ? '/data/out.trace.json' : '/data/out.rep';
  await loadUrl(url);
}

function onOpenFileClick(e: MouseEvent): void {
  e.preventDefault();
  fileInputRef.value?.click();
}

async function onFileChosen(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  status.value = 'loading';
  error.value = null;
  source.value = undefined;
  try {
    source.value = await file.arrayBuffer();
    openedName.value = file.name;
    loadToken.value += 1;
    status.value = 'ready';
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('fixture');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    status.value = 'error';
  }
}

/** I-Q6d: open full CSV text in a new browser tab. */
function onViewFullCsv(payload: { fileName: string; text: string }): void {
  const blob = new Blob([payload.text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

onMounted(async () => {
  try {
    await loadFixture(queryFixture.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    status.value = 'error';
  }
});
</script>

<template>
  <main class="playground">
    <header class="playground__chrome">
      <div class="playground__left">
        <strong>playground</strong>
        <a
          href="/?fixture=rep"
          data-testid="fixture-rep"
        >out.rep</a>
        <a
          href="/?fixture=trace"
          data-testid="fixture-trace"
        >out.trace.json</a>
        <a
          href="#"
          data-testid="open-file"
          @click="onOpenFileClick"
        >Open file…</a>
        <input
          ref="fileInputRef"
          class="playground__file"
          type="file"
          accept=".rep,.ncrep,.json,application/json,application/octet-stream"
          data-testid="open-file-input"
          @change="onFileChosen"
        >
      </div>
      <p
        class="playground__note"
        data-testid="playground-ready"
      >
        {{ status }} · {{ title }}
      </p>
      <p
        v-if="error"
        class="playground__error"
        data-testid="playground-error"
      >
        {{ error }}
      </p>
    </header>
    <div class="playground__report">
      <ProfilingReport
        v-if="source"
        :key="loadToken"
        :title="title"
        :source="source"
        locale="zh-CN"
        @view-full-csv="onViewFullCsv"
      />
      <div
        v-else-if="!error"
        class="playground__loading"
        data-testid="playground-loading"
      >
        <div class="playground__loading-frame">
          <div class="playground__loading-bar" />
          <div class="playground__loading-axis" />
          <div class="playground__loading-body" />
        </div>
        <p class="playground__loading-label">
          Loading report…
        </p>
      </div>
    </div>
  </main>
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  background: #202830;
  color: #ddd;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.playground {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.playground__chrome {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 10px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  font-size: 12px;
}

.playground__left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.playground__left a {
  color: #8ab4ff;
}

.playground__file {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.playground__note {
  margin: 0;
  opacity: 0.7;
}

.playground__error {
  margin: 0;
  color: #f88;
}

.playground__report {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
}

.playground__report > * {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
}

.playground__loading {
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

.playground__loading-frame {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  opacity: 0.55;
}

.playground__loading-bar {
  flex: 0 0 36px;
  background: #242424;
  border-bottom: 1px solid #333;
}

.playground__loading-axis {
  flex: 0 0 45px;
  background: #222;
  border-bottom: 1px solid #333;
}

.playground__loading-body {
  flex: 1 1 auto;
  background:
    repeating-linear-gradient(
      to bottom,
      #1a1a1a 0,
      #1a1a1a 21px,
      #202020 21px,
      #202020 22px
    );
}

.playground__loading-label {
  flex: 0 0 auto;
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: #9a9a9a;
  border-top: 1px solid #333;
}
</style>
