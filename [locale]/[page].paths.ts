import { localizedPages } from '../.vitepress/localized-content.ts';

const loader = {
  paths: localizedPages,
  watch: [
    '../index.md',
    '../introduction.md',
    '../courses/**/*.md',
    '../.vitepress/locales/*.ts',
  ],
};

export default loader;
