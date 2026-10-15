import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';
import { resolveBuildRevision } from './theme/analytics.js';
import { addFrontmatterKeywords, pageHeadTags } from './site-audit.js';
import { renderSearchPage } from './localized-content.js';
import { type Language, localizedPath, translations } from './i18n.ts';

const sidebar = generateSidebar({
  excludeByGlobPattern: ['README.md', '\\[locale\\]/**'],
  includeDynamicRoutes: false,
  includeRootIndexFile: false,
  manualSortFileNameByPriority: ['introduction.md'],
  useFolderTitleFromIndexFile: true,
  useTitleFromFileHeading: true,
  useTitleFromFrontmatter: true,
});

function localizedSidebar(items, language: Language) {
  const t = translations[language];
  return items.map((item) => {
    let text = item.text;
    const semester = /^Семестар (\d+)$/u.exec(text ?? '');
    if (text === translations.mk.courses) text = t.courses;
    if (semester) text = t.semester.replace('{number}', semester[1]);
    if (item.link === '/introduction') text = t.nav.introduction;
    return {
      ...item, text,
      ...(item.link && { link: localizedPath(item.link, language) }),
      ...(item.items && { items: localizedSidebar(item.items, language) }),
    };
  });
}

const localeConfig = (language: Language) => {
  const t = translations[language];
  return {
    // The custom shared dropdown supplies labels instead of the default flyout.
    label: '', lang: language, title: t.title, description: t.description,
    themeConfig: {
      ...t.theme,
      mobileMenuLabel: t.theme.navMenuLabel,
      langMenuLabel: t.language,
      nav: [
        { text: t.nav.home, link: localizedPath('/', language) },
        { text: t.nav.introduction, link: localizedPath('/introduction', language) },
      ],
      sidebar: localizedSidebar(sidebar, language),
      outline: { label: t.theme.outlineLabel },
      footer: { message: t.footer },
      notFound: {
        title: t.theme.notFoundTitle, quote: t.theme.notFoundQuote,
        linkLabel: t.theme.notFoundLinkLabel, linkText: t.theme.notFoundLinkText,
      },
    },
  };
};

export default defineConfig({
  vite: {
    define: {
      __APP_REVISION__: JSON.stringify(resolveBuildRevision(process.env)) ?? 'undefined',
    },
  },
  lang: 'mk', title: translations.mk.title, description: translations.mk.description,
  locales: { root: localeConfig('mk'), en: localeConfig('en'), sq: localeConfig('sq'), tr: localeConfig('tr') },
  transformPageData(pageData) {
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(...pageHeadTags(pageData.relativePath));
  },
  srcExclude: ['README.md'],
  markdown: { config: addFrontmatterKeywords },
  head: [
    // Google Fonts (Inter + JetBrains Mono)
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap' }],

    // Favicons
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],

    ['meta', { name: 'theme-color', content: '#0a0a0a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: 'https://recordings.finki-hub.com/favicon-96x96.png' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:image', content: 'https://recordings.finki-hub.com/favicon-96x96.png' }],
  ],
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        _render: renderSearchPage,
        locales: Object.fromEntries(Object.entries(translations).map(([language, t]) => [
          language === 'mk' ? 'root' : language, { translations: t.search },
        ])),
      },
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/finki-hub/recordings-listing' }],
    docFooter: { prev: false, next: false },
  },
});
