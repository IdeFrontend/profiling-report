<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { ProfilingReport } from '../src/index';
import {
  generateStressSwimlane,
  stressPresetFromQuery,
  stressSwimlaneStats,
  type StressSwimlanePreset,
} from '../src/domain/generateStressSwimlane';
import type { SwimlaneModel } from '../src/domain/types';

const FILE_FIXTURES = {
  rep: { name: 'out.rep', url: '/data/out.rep' },
  trace: { name: 'out.trace.json', url: '/data/out.trace.json' },
  ffn_dense: { name: 'ffn_dense.trace.json', url: '/data/ffn_dense.trace.json' },
} as const;

type FileFixtureKind = keyof typeof FILE_FIXTURES;
type FixtureKind = FileFixtureKind | 'stress';
type PreferRenderer = 'auto' | 'webgl' | 'canvas';

const status = ref('loading');
const source = shallowRef<ArrayBuffer | undefined>(undefined);
const stressModel = shallowRef<SwimlaneModel | null>(null);
const error = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const openedName = ref<string | null>(null);
const loadToken = ref(0);

function readQuery(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

const queryFixture = computed((): FixtureKind => {
  const f = readQuery().get('fixture');
  if (f === 'stress') return f;
  if (f && f in FILE_FIXTURES) return f as FileFixtureKind;
  return 'rep';
});

const stressPreset = computed((): StressSwimlanePreset =>
  stressPresetFromQuery(readQuery().get('scale')),
);

const preferRenderer = computed((): PreferRenderer => {
  const r = readQuery().get('renderer');
  if (r === 'webgl' || r === 'canvas' || r === 'auto') return r;
  return 'auto';
});

const title = computed(() => {
  if (openedName.value) return openedName.value;
  const kind = queryFixture.value;
  if (kind === 'stress') {
    const stats = stressModel.value ? stressSwimlaneStats(stressModel.value) : null;
    const n = stats ? `${stats.eventCount.toLocaleString()} events` : '…';
    return `stress (${stressPreset.value}, ${n})`;
  }
  return FILE_FIXTURES[kind].name;
});

const statusLine = computed(() => {
  const renderer = preferRenderer.value === 'auto' ? 'auto' : preferRenderer.value;
  return `${status.value} · ${title.value} · renderer=${renderer}`;
});

async function loadUrl(url: string): Promise<void> {
  status.value = 'loading';
  error.value = null;
  source.value = undefined;
  stressModel.value = null;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  source.value = await res.arrayBuffer();
  loadToken.value += 1;
  status.value = 'ready';
}

function loadStress(preset: StressSwimlanePreset): void {
  status.value = 'loading';
  error.value = null;
  source.value = undefined;
  openedName.value = null;
  // Defer so the loading chrome can paint before a large sync generate.
  requestAnimationFrame(() => {
    try {
      const model = generateStressSwimlane({}, preset);
      stressModel.value = model;
      loadToken.value += 1;
      status.value = 'ready';
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      status.value = 'error';
    }
  });
}

async function loadFixture(kind: FixtureKind): Promise<void> {
  openedName.value = null;
  if (kind === 'stress') {
    loadStress(stressPreset.value);
    return;
  }
  await loadUrl(FILE_FIXTURES[kind].url);
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
  stressModel.value = null;
  try {
    source.value = await file.arrayBuffer();
    openedName.value = file.name;
    loadToken.value += 1;
    status.value = 'ready';
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('fixture');
      url.searchParams.delete('scale');
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

function stressHref(scale: StressSwimlanePreset, renderer?: PreferRenderer): string {
  const q = new URLSearchParams();
  q.set('fixture', 'stress');
  q.set('scale', scale);
  if (renderer && renderer !== 'auto') q.set('renderer', renderer);
  else if (preferRenderer.value !== 'auto') q.set('renderer', preferRenderer.value);
  return `/?${q.toString()}`;
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
          href="/?fixture=ffn_dense"
          data-testid="fixture-ffn-dense"
        >ffn_dense.trace.json</a>
        <a
          :href="stressHref('medium')"
          data-testid="fixture-stress"
        >stress</a>
        <span class="playground__sep">·</span>
        <a
          :href="stressHref('small')"
          data-testid="stress-small"
        >small</a>
        <a
          :href="stressHref('medium')"
          data-testid="stress-medium"
        >medium</a>
        <a
          :href="stressHref('large')"
          data-testid="stress-large"
        >large</a>
        <span class="playground__sep">·</span>
        <a
          :href="stressHref(stressPreset, 'webgl')"
          data-testid="renderer-webgl"
        >webgl</a>
        <a
          :href="stressHref(stressPreset, 'canvas')"
          data-testid="renderer-canvas"
        >canvas</a>
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
        {{ statusLine }}
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
        :key="`src-${loadToken}-${preferRenderer}`"
        :title="title"
        :source="source"
        :prefer-renderer="preferRenderer"
        locale="zh-CN"
        @view-full-csv="onViewFullCsv"
      />
      <ProfilingReport
        v-else-if="stressModel"
        :key="`stress-${loadToken}-${preferRenderer}`"
        :title="title"
        :swimlane-model="stressModel"
        :prefer-renderer="preferRenderer"
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
  background: #1f1f1f;
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
  flex-wrap: wrap;
}

.playground__left a {
  color: #8ab4ff;
}

.playground__sep {
  opacity: 0.4;
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
  white-space: nowrap;
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
