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
    <h1>profiling-report playground</h1>
    <p class="playground__switch">
      <a
        href="/?fixture=rep"
        data-testid="fixture-rep"
      >out.rep</a>
      ·
      <a
        href="/?fixture=trace"
        data-testid="fixture-trace"
      >out.trace.json</a>
    </p>
    <ProfilingReport
      v-if="source"
      :title="title"
      :source="source"
      locale="zh-CN"
    />
    <ProfilingReport
      v-else
      title="Loading fixture…"
    />
    <p
      class="playground__note"
      data-testid="playground-ready"
    >
      Status: {{ status }}. Fixture: {{ fixture }}.
    </p>
    <p
      v-if="error"
      class="playground__error"
      data-testid="playground-error"
    >
      {{ error }}
    </p>
  </main>
</template>

<style>
html,
body,
#app {
  margin: 0;
  min-height: 100%;
  background: #1e1e1e;
  color: #ddd;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.playground {
  padding: 24px;
  max-width: 1100px;
}

.playground__switch {
  margin: 0 0 12px;
  font-size: 14px;
}

.playground__switch a {
  color: #8ab4ff;
}

.playground__note {
  margin-top: 16px;
  font-size: 14px;
  opacity: 0.8;
}

.playground__error {
  color: #f88;
  font-size: 14px;
}
</style>
