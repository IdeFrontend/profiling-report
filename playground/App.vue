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
        title="Loading fixture…"
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
  background: #1e1e1e;
  color: #ddd;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.playground {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  padding: 10px 12px;
  gap: 8px;
}

.playground__chrome {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 16px;
}

.playground__chrome h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.playground__switch {
  margin: 0;
  font-size: 13px;
}

.playground__switch a {
  color: #8ab4ff;
}

.playground__note {
  margin: 0;
  font-size: 12px;
  opacity: 0.75;
}

.playground__error {
  margin: 0;
  color: #f88;
  font-size: 13px;
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
