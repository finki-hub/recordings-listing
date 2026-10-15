import { computed } from 'vue';
import { useData } from 'vitepress';
import { isLanguage, translations } from '../../i18n.ts';

export function useLanguage() {
  const { lang } = useData();
  const language = computed(() => isLanguage(lang.value) ? lang.value : 'mk');
  const t = computed(() => translations[language.value]);
  return { language, t };
}
