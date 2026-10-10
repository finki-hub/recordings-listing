<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';
import { shouldShowLearnifyCallout } from '../learnify-callout.js';

const { page } = useData();
const visible = computed(() => shouldShowLearnifyCallout(page.value.relativePath));
</script>

<template>
  <div v-if="visible" class="vp-doc">
    <div class="custom-block tip">
      <p class="custom-block-title">Приватни часови</p>
      <p>За приватни часови по овој предмет, посетете <a href="https://learnify.mk">Learnify</a>.</p>
    </div>
  </div>
</template>
