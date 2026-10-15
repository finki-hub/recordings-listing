import { languageFromPath, languageLocales, localizedPath, stripLanguagePrefix, translations } from './i18n.ts';
import { shouldShowLearnifyCallout } from './theme/learnify-callout.js';

const productionOrigin = 'https://recordings.finki-hub.com';

export function addFrontmatterKeywords(md) {
  md.core.ruler.push('localized-permalink-labels', (state) => {
    const t = translations[languageFromPath(state.env?.relativePath ?? '')];
    for (const token of state.tokens) {
      if (token.type !== 'inline') continue;
      for (const child of token.children ?? []) {
        if (child.type === 'link_open' && child.attrGet('class') === 'header-anchor') {
          const title = child.attrGet('aria-label')?.replace(/^Permalink to “(.*)”$/u, '$1') ?? '';
          child.attrSet('aria-label', t.theme.permalink.replace('{title}', title));
        }
      }
    }
  });
  md.core.ruler.push('frontmatter-keywords', (state) => {
    const keywords = state.env?.frontmatter?.keywords;
    if (!Array.isArray(keywords) || keywords.length === 0) return true;

    // Keep aliases in the page-level search section instead of the final one
    // (often Notes), while hiding them from the rendered course page.
    const headingCloseIndex = state.tokens.findIndex(
      (token) => token.type === 'heading_close' && token.tag === 'h1',
    );
    if (headingCloseIndex === -1) return true;

    const token = new state.Token('html_block', '', 0);
    token.content = `<div style="display:none">${keywords.join(' ')}</div>`;
    state.tokens.splice(headingCloseIndex + 1, 0, token);
    return true;
  });

  md.core.ruler.push('learnify-callout-after-title', (state) => {
    if (!shouldShowLearnifyCallout(state.env?.relativePath)) return true;

    const headingCloseIndex = state.tokens.findIndex(
      (token) => token.type === 'heading_close' && token.tag === 'h1',
    );
    if (headingCloseIndex === -1) return true;

    const token = new state.Token('html_block', '', 0);
    token.content = '<LearnifyCourseCallout />\n';
    state.tokens.splice(headingCloseIndex + 1, 0, token);
    return true;
  });
}

export function pageHeadTags(relativePath) {
  const route = relativePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.md$/i, '.html');
  const canonicalRoute = stripLanguagePrefix(route);
  const alternateRoute = canonicalRoute === 'index.html' ? '/' : `/${canonicalRoute}`;
  const url = productionOrigin + localizedPath(alternateRoute, languageFromPath(relativePath));

  const language = languageFromPath(relativePath);
  const t = translations[language];
  return [
    ['meta', { name: 'author', content: t.brand }],
    ['meta', { property: 'og:title', content: t.title }],
    ['meta', { property: 'og:description', content: t.description }],
    ['meta', { property: 'og:locale', content: languageLocales[language].replace('-', '_') }],
    ['meta', { name: 'twitter:title', content: t.title }],
    ['meta', { name: 'twitter:description', content: t.description }],
    ...Object.keys(translations).map((code) => ['link', { rel: 'alternate', hreflang: code, href: productionOrigin + localizedPath(alternateRoute, code) }]),
    ['link', { rel: 'canonical', href: url }],
    ['meta', { property: 'og:url', content: url }],
  ];
}
