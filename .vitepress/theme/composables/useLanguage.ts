import { useData } from 'vitepress';
import { computed } from 'vue';

import { isLanguage, translations } from '../../i18n.ts';

export const useLanguage = () => {
  const { lang } = useData();
  const language = computed(() => (isLanguage(lang.value) ? lang.value : 'mk'));
  const t = computed(() => translations[language.value]);
  return { language, t };
};
