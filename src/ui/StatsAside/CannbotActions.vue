<script setup lang="ts">
import { computed } from 'vue';
import type { CannbotScope, CannbotSessions } from '../../domain/cannbot';
import { t } from '../../i18n';
import CannworkAnalyseIcon from '../CannworkAnalyseIcon.vue';
import CannworkStopIcon from '../CannworkStopIcon.vue';
import CannworkReferenceIcon from '../CannworkReferenceIcon.vue';
import CannworkReportIcon from '../CannworkReportIcon.vue';

/**
 * One scope's CANNWork action buttons, driven purely by the host-pushed session
 * state (scope state machine, design doc §7.2):
 * - idle    — no session yet (or host never pushed sessions): 分析 | 引用.
 * - running — session status `running`: 正在分析 | 引用, stop click emits stop.
 * - settled — session finished (completed / stopped / error / unknown): 分析 | 引用 | 查看.
 *
 * 引用 is always visible (right of the analyse / analysing button): it opens the
 * add-reference flow in the host; the CANNWork add-reference api is not ready
 * yet, so the host currently logs a placeholder.
 *
 * `data-testid="cannbot-{scope}"` always lands on the button existing tests click
 * (the idle 分析 button, the running stop button, or the settled 分析 button);
 * 引用 / 查看 carry their own `-reference` / `-view` suffixes.
 */
const props = defineProps<{
  scope: CannbotScope;
  /** Latest session per scope. Undefined = host never injected → every scope stays idle. */
  sessions?: CannbotSessions;
  locale?: string;
}>();

const emit = defineEmits<{
  'open-cannbot': [scope: CannbotScope];
  'open-cannbot-stop': [scope: CannbotScope];
  'cannbot-reference': [scope: CannbotScope];
  'cannbot-view': [scope: CannbotScope];
}>();

const session = computed(() => props.sessions?.[props.scope]);
const isRunning = computed(() => session.value?.status === 'running');
const isSettled = computed(() => !!session.value && session.value.status !== 'running');
</script>

<template>
  <div
    class="pr-cannbot-actions"
    :class="{ 'pr-cannbot-actions--running': isRunning }"
  >
    <button
      v-if="isRunning"
      type="button"
      class="pr-cannbot-actions__btn pr-cannbot-actions__stop"
      :data-testid="`cannbot-${scope}`"
      :aria-label="t('cannbotStop', locale)"
      :title="t('cannbotStop', locale)"
      @click="emit('open-cannbot-stop', scope)"
    >
      <CannworkStopIcon />
      <span>{{ t('cannbotAnalyzing', locale) }}</span>
    </button>
    <button
      v-else
      type="button"
      class="pr-cannbot-actions__btn"
      :data-testid="`cannbot-${scope}`"
      :aria-label="t('cannbotAsk', locale)"
      :title="t('cannbotAsk', locale)"
      @click="emit('open-cannbot', scope)"
    >
      <CannworkAnalyseIcon />
    </button>
    <button
      type="button"
      class="pr-cannbot-actions__btn"
      :data-testid="`cannbot-${scope}-reference`"
      :aria-label="t('cannbotReference', locale)"
      :title="t('cannbotReference', locale)"
      @click="emit('cannbot-reference', scope)"
    >
      <CannworkReferenceIcon />
    </button>
    <button
      v-if="isSettled"
      type="button"
      class="pr-cannbot-actions__btn"
      :data-testid="`cannbot-${scope}-view`"
      :aria-label="t('cannbotView', locale)"
      :title="t('cannbotView', locale)"
      @click="emit('cannbot-view', scope)"
    >
      <CannworkReportIcon />
    </button>
  </div>
</template>

<style scoped>
.pr-cannbot-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  line-height: 0;
}

.pr-cannbot-actions__btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #e6e6e6;
  opacity: 0.85;
  border-radius: 4px;
}

.pr-cannbot-actions__btn:hover {
  opacity: 1;
}

/* 引用常驻：任意状态都有 ≥2 个按钮，相邻按钮间发丝分隔，整行读作一个 pill。 */
.pr-cannbot-actions__btn + .pr-cannbot-actions__btn {
  border-left: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0 0 0 0;
}

.pr-cannbot-actions__btn:last-child {
  border-radius: 0 4px 4px 0;
}

/* Running: stop glyph + blue label, full opacity (it is the live state, not an affordance). */
.pr-cannbot-actions__stop {
  gap: 4px;
  font-size: 12px;
  line-height: 16px;
  color: #4c9ff8;
  opacity: 1;
}
</style>
