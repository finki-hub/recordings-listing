<script setup lang="ts">
import { Check, ChevronDown, Globe } from '@lucide/vue';
import { ref, useId } from 'vue';
import { useRouter } from 'vitepress';
import {
  SelectRoot, SelectTrigger, SelectValue, SelectIcon, SelectPortal,
  SelectContent, SelectViewport, SelectGroup, SelectLabel,
  SelectItem, SelectItemText, SelectItemIndicator,
} from 'reka-ui';
import { isLanguage, languageNames, localizedPath, saveLanguagePreference } from '../../i18n.ts';
import { useLanguage } from '../composables/useLanguage';

const { language, t } = useLanguage();
const router = useRouter();
const id = useId();
const trigger = ref<HTMLButtonElement | null>(null);
let usedPointer = false;
const markPointer = () => { usedPointer = true; };
const markKeyboard = () => { usedPointer = false; };
const restoreFocus = (event: Event) => {
  if (!usedPointer) return;
  event.preventDefault();
  trigger.value?.focus({ preventScroll: true, focusVisible: false });
};
const choose = (value: unknown) => {
  if (!isLanguage(value)) return;
  saveLanguagePreference(value);
  void router.go(localizedPath(location.pathname, value) + location.search + location.hash);
};
</script>

<template>
  <div class="recordings-language">
    <label :id="`${id}-label`" :for="id" class="visually-hidden">{{ t.language }}</label>
    <SelectRoot :model-value="language" @update:model-value="choose">
      <SelectTrigger as-child>
        <button :id="id" ref="trigger" class="language-trigger" type="button"
          @pointerdown="markPointer" @keydown="markKeyboard">
          <Globe aria-hidden="true" :size="16" />
          <SelectValue><span :title="languageNames[language]">{{ language.toUpperCase() }}</span></SelectValue>
          <SelectIcon class="language-chevron"><ChevronDown aria-hidden="true" :size="16" /></SelectIcon>
        </button>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent class="language-content" position="popper" align="end" :side-offset="6"
          :aria-labelledby="`${id}-label`" @close-auto-focus="restoreFocus"
          @pointerdown="markPointer" @pointer-down-outside="markPointer" @keydown="markKeyboard">
          <SelectViewport class="language-viewport">
            <SelectGroup>
              <SelectLabel class="language-label">{{ t.language }}</SelectLabel>
              <SelectItem v-for="(name, code) in languageNames" :key="code" :value="code"
                :text-value="name" class="language-item">
                <SelectItemText class="language-item-text">
                  <span class="language-code" aria-hidden="true">{{ code.toUpperCase() }}</span>
                  <span :lang="code" class="language-name">{{ name }}</span>
                </SelectItemText>
                <SelectItemIndicator class="language-check"><Check aria-hidden="true" :size="16" /></SelectItemIndicator>
              </SelectItem>
            </SelectGroup>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

<style>
.recordings-language { display: flex; flex-shrink: 0; align-items: center; margin-left: 12px; }
.language-trigger {
  display: flex; height: 40px; align-items: center; justify-content: space-between; gap: 6px;
  border: 1px solid color-mix(in srgb, var(--vp-c-border) 60%, transparent); border-radius: 12px;
  background: color-mix(in srgb, var(--vp-c-bg) 80%, transparent); padding: 8px 12px;
  color: var(--vp-c-text-1); font-size: 14px; font-weight: 500; line-height: 20px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); backdrop-filter: blur(4px);
  transition: background-color 150ms;
}
.language-trigger:hover, .language-trigger[data-state='open'] { background: var(--vp-c-default-soft); }
.language-trigger:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.language-chevron { display: flex; opacity: .5; transition: transform 150ms; }
.language-trigger[data-state='open'] .language-chevron { transform: rotate(180deg); }
.language-content {
  z-index: 100; min-width: 208px; max-height: var(--reka-select-content-available-height);
  overflow: hidden; border: 1px solid color-mix(in srgb, var(--vp-c-border) 60%, transparent);
  border-radius: 12px; background: color-mix(in srgb, var(--vp-c-bg-elv) 95%, transparent);
  color: var(--vp-c-text-1); box-shadow: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1);
  backdrop-filter: blur(12px); transform-origin: var(--reka-select-content-transform-origin);
}
.language-content[data-state='open'] { animation: language-open 150ms ease-out; }
.language-content[data-state='closed'] { animation: language-close 100ms ease-in; }
.language-viewport { padding: 4px; }
.language-label { padding: 4px 8px; font-size: 12px; font-weight: 500; line-height: 20px; color: var(--vp-c-text-2); }
.language-item { position: relative; display: flex; min-height: 40px; align-items: center; border-radius: 8px; padding: 6px 32px 6px 8px; font-size: 14px; line-height: 20px; outline: none; cursor: default; user-select: none; }
.language-item[data-highlighted] { background: var(--vp-c-default-soft); }
.language-item-text { display: flex; align-items: center; gap: 12px; }
.language-code { display: inline-flex; width: 32px; height: 24px; align-items: center; justify-content: center; border: 1px solid var(--vp-c-border); border-radius: 6px; background: var(--vp-c-default-soft); color: var(--vp-c-text-2); font-size: 11px; font-weight: 600; letter-spacing: .025em; }
.language-item[data-state='checked'] .language-code { border-color: color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent); background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.language-item[data-state='checked'] .language-name { font-weight: 500; }
.language-check { position: absolute; right: 8px; display: flex; align-items: center; justify-content: center; color: var(--vp-c-brand-1); }
@keyframes language-open { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
@keyframes language-close { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.95); } }
@media (prefers-reduced-motion: reduce) { .language-content { animation: none !important; } .language-chevron { transition: none; } }
</style>
