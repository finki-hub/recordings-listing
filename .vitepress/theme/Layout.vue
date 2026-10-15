<script setup lang="ts">
import { onMounted } from 'vue';
import DefaultTheme from 'vitepress/theme';
import { useRouter } from 'vitepress';
import LanguageSelect from './components/LanguageSelect.vue';
import { useLanguage } from './composables/useLanguage';
import { localizedPath, readLanguagePreference, saveLanguagePreference } from '../i18n.ts';

const router = useRouter();
const { language, t } = useLanguage();
onMounted(() => {
  const preferred = readLanguagePreference();
  if (language.value === 'mk' && preferred !== 'mk') {
    void router.go(localizedPath(location.pathname, preferred) + location.search + location.hash);
  } else if (language.value !== 'mk') {
    saveLanguagePreference(language.value);
  }
});
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after><LanguageSelect /></template>
    <template #sidebar-nav-before>
      <span id="localized-sidebar-label" class="visually-hidden">{{ t.theme.sidebarNavigation }}</span>
    </template>
  </DefaultTheme.Layout>
</template>
