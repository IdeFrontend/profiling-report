<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import type { DependencyNeighbors } from '../../domain/dependencies';
import type { DependencyMode, SelectedEvent } from '../../domain/types';
import PrIcon from '../PrIcon.vue';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../panelResize';
import DetailSummary from './DetailSummary/DetailSummary.vue';
import DetailParameter from './DetailParameter/DetailParameter.vue';
import DetailRelevant from './DetailRelevant/DetailRelevant.vue';

const props = withDefaults(
  defineProps<{
    selected: SelectedEvent;
    /** Display origin (usually model.minTime); start/end are relative to this. */
    timeOrigin?: number;
    locale?: string;
    /** Omitted when the report carries no dependency data — the column hides. */
    neighbors?: DependencyNeighbors;
    dependencyMode?: DependencyMode;
    expanded?: boolean;
  }>(),
  {
    expanded: false,
    locale: undefined,
    neighbors: undefined,
    dependencyMode: 'all',
    timeOrigin: 0,
  },
);

const emit = defineEmits<{
  close: [];
  'update:dependencyMode': [mode: DependencyMode];
  'update:expanded': [expanded: boolean];
}>();

const expanderLabel = computed(() =>
  t(props.expanded ? 'collapseDock' : 'expandDock', props.locale),
);

/** Fed through a custom property rather than `height` directly, so the enter/leave
 *  transition classes can still override the height — an inline `height` could not
 *  be beaten by a class. */
const dockStyle = computed(() => ({
  '--pr-dock-h': `${props.expanded ? DOCK_HEIGHT_EXPANDED : DOCK_HEIGHT_COLLAPSED}px`,
}));
</script>

<template>
  <footer
    class="pr-detail-panel"
    data-testid="detail-panel"
    :style="dockStyle"
  >
    <button
      type="button"
      class="pr-detail-panel__expander"
      :class="{ 'pr-detail-panel__expander--expanded': expanded }"
      data-testid="detail-panel-expander"
      :aria-label="expanderLabel"
      :aria-expanded="expanded"
      :title="expanderLabel"
      @click="emit('update:expanded', !expanded)"
    >
      <span class="pr-detail-panel__expander-bar" />
      <span class="pr-detail-panel__expander-arrow" />
    </button>
    <header class="pr-detail-panel__head">
      <span class="pr-detail-panel__tab">{{ t('details', locale) }}</span>
      <button
        type="button"
        class="pr-detail-panel__close"
        data-testid="detail-panel-close"
        :aria-label="t('closePanel', locale)"
        :title="t('closePanel', locale)"
        @click="emit('close')"
      >
        <PrIcon name="close" />
      </button>
    </header>

    <div
      class="pr-detail-panel__body"
      :class="{ 'pr-detail-panel__body--no-relevant': !neighbors }"
    >
      <DetailSummary
        :selected="selected"
        :time-origin="timeOrigin"
        :locale="locale"
      />
      <DetailParameter
        :args="selected.args"
        :locale="locale"
      />
      <DetailRelevant
        v-if="neighbors"
        :current-name="selected.name"
        :neighbors="neighbors"
        :mode="dependencyMode"
        :locale="locale"
        @update:mode="emit('update:dependencyMode', $event)"
      />
    </div>
  </footer>
</template>

<style scoped>
.pr-detail-panel {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  position: relative;
  /* One of two sketch heights, never a free drag: a content-sized panel grows and
     shrinks with every selection, which shifts the whole timeline above it.
     Border-box so the constant is the dock's real height and `height: 0` on leave
     collapses fully rather than leaving the top border behind. */
  box-sizing: border-box;
  /* Cap against the viewport so a short host (split pane, 600px embed) cannot have the
     expanded height eat the timeline — the old drag path left `innerHeight - 160`. */
  height: min(var(--pr-dock-h), 60vh);
  background: var(--pr-bg-panel, #262626);
  border-top: 1px solid #3a3a3a;
  /* The header is transparent, so rounding the dock rounds the visible top corners. */
  border-radius: 16px 16px 0 0;
  /* Clips the body while the height animates. Safe now that the expander sits inside
     the dock; the old drag handle straddled this edge and would have been cut. */
  overflow: hidden;
  transition: height 200ms ease;
}

/* Sketch affordance: a 14x1 bar and a small solid triangle, centred on the dock's top
   edge. The two swap order between states — triangle above the bar reads as "push up
   to expand", below it as "push down to collapse" — which is just the flex direction. */
.pr-detail-panel__expander {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 2px;
  /* Padding only, so the 14x8 visual keeps its sketch position while the hit target
     reaches a usable size. */
  margin: 0;
  padding: 4px 16px 10px;
  border: 0;
  background: transparent;
  color: #6c6c6c;
  cursor: pointer;
}

.pr-detail-panel__expander--expanded {
  flex-direction: column;
}

.pr-detail-panel__expander:hover {
  color: #b3b3b3;
}

.pr-detail-panel__expander-bar {
  width: 14px;
  height: 1px;
  background: currentColor;
}

.pr-detail-panel__expander-arrow {
  width: 0;
  height: 0;
  border-right: 3px solid transparent;
  border-bottom: 4px solid currentColor;
  border-left: 3px solid transparent;
}

.pr-detail-panel__expander--expanded .pr-detail-panel__expander-arrow {
  border-top: 4px solid currentColor;
  border-bottom: 0;
}

.pr-detail-panel__head {
  display: flex;
  /* Stretch, not center: the tab's underline has to reach the header rule. */
  align-items: stretch;
  justify-content: space-between;
  box-sizing: border-box;
  height: 52px;
  flex: 0 0 auto;
  padding: 8px 12px 0;
  border-bottom: 1px solid #3a3a3a;
}

.pr-detail-panel__tab {
  display: flex;
  align-items: center;
  /* Sketch marks the active tab with a white rule, not the playhead blue, and sits it
     directly on the header rule: underline at +49..+51 from the dock top, rule +51..+52.
     Centring the tab instead left the underline floating mid-header. */
  border-bottom: 2px solid #fff;
  font-size: 13px;
  font-weight: 600;
}

.pr-detail-panel__close {
  display: inline-flex;
  align-self: center;
  align-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  cursor: pointer;
}

.pr-detail-panel__close:hover {
  color: #f0f0f0;
}

.pr-detail-panel__body {
  display: grid;
  /* Identity card is `min-content`: it fits its start / duration / end row exactly and
     never stretches, so those figures cannot be cropped and the leftover width all goes
     to the parameter list and graph. The sketch's 290px was a fixed track, which cropped
     as soon as a value ran wide — a nanosecond timestamp in `s` does. Only the metrics
     resist shrinking; the event name still ellipsizes, so a long one cannot widen the
     card past the figures it exists to show. */
  grid-template-columns: min-content minmax(240px, 1.5fr) minmax(280px, 1.2fr);
  gap: 0;
  align-items: stretch;
  /* Claim the height the dock's `height` prop gives us. Content-sized (`0 1 auto`),
     the body stayed ~173px however far the top edge was dragged, so every column —
     and the scroll area inside each — ignored the drag. */
  flex: 1 1 auto;
  padding: 8px 12px 12px;
  min-height: 0;
  /* Recoverable when the min-content identity card + sibling mins exceed the dock —
     the panel itself is overflow:hidden for the height animation, so without this the
     Relevent column would clip with no scrollbar. */
  overflow: auto;
}

/* No dependency data: drop the Relevent track so Parameter takes its width. */
.pr-detail-panel__body--no-relevant {
  grid-template-columns: min-content minmax(240px, 1fr);
}

/* Appear / disappear share the resize transition, so the timeline above reflows at the
   same rate however the dock's height changed. Two class names deep to beat the base
   rule's `var(--pr-dock-h)` without depending on source order. */
.pr-detail-panel.pr-dock-enter-from,
.pr-detail-panel.pr-dock-leave-to {
  height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pr-detail-panel {
    transition: none;
  }
}
</style>
