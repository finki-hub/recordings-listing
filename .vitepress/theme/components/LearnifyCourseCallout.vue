<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';
import { useLanguage } from '../composables/useLanguage';
import { shouldShowLearnifyCallout } from '../learnify-callout.js';

const { page } = useData();
const { t } = useLanguage();
const visible = computed(() => shouldShowLearnifyCallout(page.value.relativePath));
</script>

<template>
  <div v-if="visible" class="vp-doc">
    <div class="custom-block tip">
      <p class="custom-block-title">{{ t.learnify.title }}</p>
      <p>{{ t.learnify.before }} <a href="https://learnify.mk">Learnify</a>{{ t.learnify.after }}</p>
    </div>
  </div>
</template>
