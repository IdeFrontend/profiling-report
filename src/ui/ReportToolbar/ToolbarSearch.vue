<script setup lang="ts">
import { nextTick, ref } from 'vue';
import PrIcon from '../PrIcon.vue';
import { t } from '../../i18n';

withDefaults(
  defineProps<{
    modelValue: string;
    locale?: string;
    inputTestId?: string;
    clearTestId?: string;
    iconTestId?: string;
  }>(),
  {
    locale: undefined,
    inputTestId: 'search-input',
    clearTestId: 'search-clear',
    iconTestId: 'search-magnifier',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  /** Enter in the field (find-next on Source). Clear-button Enter does not emit. */
  submit: [];
}>();

const searchInputRef = ref<HTMLInputElement | null>(null);

/** Clear query and keep focus on the input (button unmounts when empty). */
function clearSearch() {
  emit('update:modelValue', '');
  void nextTick(() => searchInputRef.value?.focus());
}

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function onEnter(event: KeyboardEvent) {
  event.preventDefault();
  emit('submit');
}
</script>

<template>
  <div class="pr-toolbar__search">
    <label class="pr-toolbar__search-field">
      <span class="pr-toolbar__sr">{{ t('searchLabel', locale) }}</span>
      <PrIcon
        name="search"
        class="pr-toolbar__search-icon"
        :data-testid="iconTestId"
      />
      <input
        ref="searchInputRef"
        :data-testid="inputTestId"
        type="search"
        :value="modelValue"
        :placeholder="t('searchPlaceholder', locale)"
        @input="onInput"
        @keydown.enter="onEnter"
      >
    </label>
    <button
      v-if="modelValue.length > 0"
      type="button"
      class="pr-toolbar__search-clear"
      :data-testid="clearTestId"
      :aria-label="t('searchClear', locale)"
      @mousedown.prevent
      @click="clearSearch"
      @keydown.enter.prevent="clearSearch"
      @keydown.space.prevent="clearSearch"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
/* Search pill — shared by the timeline toolbar and Source chrome.
   Fixed 190px box: the clear × is absolute, so a query does not change width. */
.pr-toolbar__search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 190px;
  width: 190px;
  height: var(--pr-toolbar-h, 28px);
}

.pr-toolbar__search-field {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--pr-toolbar-h, 28px);
}

.pr-toolbar__search-icon {
  position: absolute;
  left: 10px;
  color: #9a9a9a;
  pointer-events: none;
  display: block;
}

.pr-toolbar__search input {
  box-sizing: border-box;
  width: 190px;
  height: var(--pr-toolbar-h, 28px);
  padding: 0 12px 0 32px;
  border: 0;
  border-radius: 4px;
  background: #2a2a2a;
  color: #e0e0e0;
  font-size: 12px;
}

/* Room for the clear × when a query is present. Padding stays inside the 190px box. */
.pr-toolbar__search:has(.pr-toolbar__search-clear) input {
  padding-right: 28px;
}

.pr-toolbar__search input::placeholder {
  color: #808080;
}

.pr-toolbar__search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.pr-toolbar__search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  appearance: none;
  border: 0;
  background: transparent;
  color: #9a9a9a;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
}

.pr-toolbar__search-clear:focus {
  outline: none;
}

.pr-toolbar__search-clear:hover {
  color: #d0d0d0;
}

.pr-toolbar__search-clear:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 1px;
  border-radius: 2px;
}

/* Chrome draws its focus ring on click for text inputs, not just on keyboard
   entry, so suppress the default and re-add it for :focus-visible only.
   Inset ring: an outer outline clips under toolbar overflow-x: clip. */
.pr-toolbar__search input:focus {
  outline: none;
}

.pr-toolbar__search input:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--pr-playhead, #3078f0);
}

.pr-toolbar__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
