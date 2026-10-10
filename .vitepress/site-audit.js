import { shouldShowLearnifyCallout } from './theme/learnify-callout.js';

const productionOrigin = 'https://recordings.finki-hub.com';

export function addFrontmatterKeywords(md) {
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
  const url = route === 'index.html' ? `${productionOrigin}/` : `${productionOrigin}/${route}`;

  return [
    ['link', { rel: 'canonical', href: url }],
    ['meta', { property: 'og:url', content: url }],
  ];
}
