import { localizedPages } from '../.vitepress/localized-content.js';

export default {
  watch: ['../index.md', '../introduction.md', '../courses/**/*.md', '../.vitepress/locales/*.ts'],
  paths: localizedPages,
};
