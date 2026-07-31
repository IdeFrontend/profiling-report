<script setup lang="ts">
import { ProfilingReport } from '../src/index';
</script>

<template>
  <main class="playground">
    <h1>profiling-report playground</h1>
    <ProfilingReport title="Milestone 1 scaffold" />
    <p
      class="playground__note"
      data-testid="playground-ready"
    >
      Ready. Feature slices will load <code>data/out.rep</code> here.
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
  max-width: 960px;
}

.playground__note {
  margin-top: 16px;
  font-size: 14px;
  opacity: 0.8;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
