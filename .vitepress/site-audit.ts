import type { HeadConfig, MarkdownRenderer } from 'vitepress';

import {
  isLanguage,
  languageFromPath,
  languageLocales,
  localizedPath,
  stripLanguagePrefix,
  translations,
} from './i18n.ts';
import { shouldShowLearnifyCallout } from './theme/learnify-callout.ts';

const permalinkPattern = /^Permalink to “(?<capture1>.*)”$/u;
const leadingSlashesPattern = /^\/+/u;
const markdownExtensionPattern = /\.md$/iu;

const productionOrigin = 'https://recordings.finki-hub.com';

export const addFrontmatterKeywords = (md: MarkdownRenderer) => {
  md.core.ruler.push('localized-permalink-labels', (state) => {
    const env = state.env as { relativePath?: string };
    const t = translations[languageFromPath(env.relativePath ?? '')];
    for (const token of state.tokens) {
      if (token.type !== 'inline') continue;
      const children = token.children ?? [];
      for (const child of children) {
        if (!(
          child.type === 'link_open' &&
          child.attrGet('class') === 'header-anchor'
        )) {
          continue;
        }

        const title =
          child
            .attrGet('aria-label')
            ?.replace(permalinkPattern, '$<capture1>') ?? '';
        child.attrSet(
          'aria-label',
          t.theme.permalink.replace('{title}', () => title),
        );
      }
    }
  });
  md.core.ruler.push('frontmatter-keywords', (state) => {
    const env = state.env as { frontmatter?: { keywords?: unknown } };
    const keywords = env.frontmatter?.keywords;
    if (!Array.isArray(keywords) || keywords.length === 0) return;

    // Keep aliases in the page-level search section instead of the final one
    // (often Notes), while hiding them from the rendered course page.
    const headingCloseIndex = state.tokens.findIndex(
      (token) => token.type === 'heading_close' && token.tag === 'h1',
    );
    if (headingCloseIndex === -1) return;

    const insertedToken = new state.Token('html_block', '', 0);
    insertedToken.content = `<div style="display:none">${keywords.join(' ')}</div>`;
    state.tokens.splice(headingCloseIndex + 1, 0, insertedToken);
  });

  md.core.ruler.push('learnify-callout-after-title', (state) => {
    if (
      !shouldShowLearnifyCallout(
        (state.env as { relativePath?: string }).relativePath,
      )
    )
      return;

    const headingCloseIndex = state.tokens.findIndex(
      (token) => token.type === 'heading_close' && token.tag === 'h1',
    );
    if (headingCloseIndex === -1) return;

    const insertedToken = new state.Token('html_block', '', 0);
    insertedToken.content = '<LearnifyCourseCallout />\n';
    state.tokens.splice(headingCloseIndex + 1, 0, insertedToken);
  });
};

export const pageHeadTags = (relativePath: string): HeadConfig[] => {
  const route = relativePath
    .replaceAll('\\', '/')
    .replace(leadingSlashesPattern, '')
    .replace(markdownExtensionPattern, '.html');
  const canonicalRoute = stripLanguagePrefix(route);
  const alternateRoute =
    canonicalRoute === 'index.html' ? '/' : `/${canonicalRoute}`;
  const url =
    productionOrigin +
    localizedPath(alternateRoute, languageFromPath(relativePath));

  const language = languageFromPath(relativePath);
  const t = translations[language];
  return [
    ['meta', { content: t.brand, name: 'author' }],
    ['meta', { content: t.title, property: 'og:title' }],
    ['meta', { content: t.description, property: 'og:description' }],
    [
      'meta',
      {
        content: languageLocales[language].replace('-', '_'),
        property: 'og:locale',
      },
    ],
    ['meta', { content: t.title, name: 'twitter:title' }],
    ['meta', { content: t.description, name: 'twitter:description' }],
    ...Object.keys(translations)
      .filter(isLanguage)
      .map((code): HeadConfig => [
        'link',
        {
          href: productionOrigin + localizedPath(alternateRoute, code),
          hreflang: code,
          rel: 'alternate',
        },
      ]),
    ['link', { href: url, rel: 'canonical' }],
    ['meta', { content: url, property: 'og:url' }],
  ];
};
