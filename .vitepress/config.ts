import { type DefaultTheme, defineConfig, type HeadConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

import { type Language, localizedPath, translations } from './i18n.ts';
import { renderSearchPage } from './localized-content.ts';
import { addFrontmatterKeywords, pageHeadTags } from './site-audit.ts';
import { resolveBuildRevision } from './theme/analytics.ts';

const semesterHeadingPattern = /^Семестар (?<capture1>\d+)$/u;

const sidebar = generateSidebar({
  excludeByGlobPattern: ['README.md', String.raw`\[locale\]/**`],
  includeDynamicRoutes: false,
  includeRootIndexFile: false,
  manualSortFileNameByPriority: ['introduction.md'],
  useFolderTitleFromIndexFile: true,
  useTitleFromFileHeading: true,
  useTitleFromFrontmatter: true,
});

const localizedSidebar = (
  items: DefaultTheme.SidebarItem[],
  language: Language,
): DefaultTheme.SidebarItem[] => {
  const t = translations[language];
  return items.map((item) => {
    let text = item.text;
    const semester = semesterHeadingPattern.exec(text ?? '');
    if (text === translations.mk.courses) text = t.courses;
    if (semester?.at(1))
      text = t.semester.replace('{number}', () => semester.at(1) ?? '');
    if (item.link === '/introduction') text = t.nav.introduction;
    return {
      ...item,
      text,
      ...(item.link && { link: localizedPath(item.link, language) }),
      ...(item.items && { items: localizedSidebar(item.items, language) }),
    };
  });
};

const localeConfig = (language: Language) => {
  const t = translations[language];
  return {
    description: t.description, // The custom shared dropdown supplies labels instead of the default flyout.
    label: '',
    lang: language,
    themeConfig: {
      ...t.theme,
      footer: { message: t.footer },
      langMenuLabel: t.language,
      mobileMenuLabel: t.theme.navMenuLabel,
      nav: [
        { link: localizedPath('/', language), text: t.nav.home },
        {
          link: localizedPath('/introduction', language),
          text: t.nav.introduction,
        },
      ],
      notFound: {
        linkLabel: t.theme.notFoundLinkLabel,
        linkText: t.theme.notFoundLinkText,
        quote: t.theme.notFoundQuote,
        title: t.theme.notFoundTitle,
      },
      outline: { label: t.theme.outlineLabel },
      sidebar: localizedSidebar(
        Array.isArray(sidebar) ? sidebar : [],
        language,
      ),
    },
    title: t.title,
  };
};

export default defineConfig({
  description: translations.mk.description,
  head: [
    // Google Fonts (Inter + JetBrains Mono)
    ['link', { href: 'https://fonts.googleapis.com', rel: 'preconnect' }],
    [
      'link',
      { crossorigin: '', href: 'https://fonts.gstatic.com', rel: 'preconnect' },
    ],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
        rel: 'stylesheet',
      },
    ],

    // Favicons
    [
      'link',
      {
        href: '/favicon-96x96.png',
        rel: 'icon',
        sizes: '96x96',
        type: 'image/png',
      },
    ],
    ['link', { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' }],
    ['link', { href: '/favicon.ico', rel: 'shortcut icon' }],
    [
      'link',
      {
        href: '/apple-touch-icon.png',
        rel: 'apple-touch-icon',
        sizes: '180x180',
      },
    ],
    ['link', { href: '/site.webmanifest', rel: 'manifest' }],

    ['meta', { content: '#0a0a0a', name: 'theme-color' }],
    ['meta', { content: 'website', property: 'og:type' }],
    [
      'meta',
      {
        content: 'https://recordings.finki-hub.com/favicon-96x96.png',
        property: 'og:image',
      },
    ],
    ['meta', { content: 'summary', name: 'twitter:card' }],
    [
      'meta',
      {
        content: 'https://recordings.finki-hub.com/favicon-96x96.png',
        name: 'twitter:image',
      },
    ],
  ],
  lang: 'mk',
  locales: {
    en: localeConfig('en'),
    root: localeConfig('mk'),
    sq: localeConfig('sq'),
    tr: localeConfig('tr'),
  },
  markdown: { config: addFrontmatterKeywords },
  srcExclude: ['README.md'],
  themeConfig: {
    docFooter: { next: false, prev: false },
    search: {
      options: {
        _render: renderSearchPage,
        locales: Object.fromEntries(
          Object.entries(translations).map(([language, t]) => [
            language === 'mk' ? 'root' : language,
            { translations: t.search },
          ]),
        ),
      },
      provider: 'local',
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/finki-hub/recordings-listing',
      },
    ],
  },
  title: translations.mk.title,
  transformPageData(pageData) {
    const head = pageData.frontmatter['head'] as HeadConfig[] | undefined;
    pageData.frontmatter['head'] = [
      ...(head ?? []),
      ...pageHeadTags(pageData.relativePath),
    ];
  },
  vite: {
    define: {
      __APP_REVISION__:
        resolveBuildRevision(process.env) === undefined
          ? 'undefined'
          : JSON.stringify(resolveBuildRevision(process.env)),
    },
  },
});
