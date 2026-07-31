<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { ProfilingReport } from '../src/index';

const status = ref('loading');
const source = shallowRef<ArrayBuffer | undefined>(undefined);
const error = ref<string | null>(null);

const fixture = computed(() => {
  if (typeof window === 'undefined') return 'rep';
  return new URLSearchParams(window.location.search).get('fixture') === 'trace'
    ? 'trace'
    : 'rep';
});

const title = computed(() =>
  (fixture.value === 'trace' ? 'out.trace.json' : 'out.rep'),
);

onMounted(async () => {
  try {
    const url =
      fixture.value === 'trace' ? '/data/out.trace.json' : '/data/out.rep';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }
    source.value = await res.arrayBuffer();
    status.value = 'ready';
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
      </div>
      <p
        class="playground__note"
        data-testid="playground-ready"
      >
        {{ status }} · {{ fixture }}
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
        :title="title"
        :source="source"
        locale="zh-CN"
      />
      <ProfilingReport
        v-else
        title="Loading…"
      />
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
</style>
