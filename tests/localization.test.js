import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMarkdownRenderer } from 'vitepress';
import {
  isLanguage, languageFromPath, localizedPath, readLanguagePreference,
  saveLanguagePreference, stripLanguagePrefix, translations,
} from '../.vitepress/i18n.ts';
import { contentRoot, localizeMarkdown, localizedPages, sourcePages } from '../.vitepress/localized-content.js';
import { pageHeadTags } from '../.vitepress/site-audit.js';
import { shouldShowLearnifyCallout } from '../.vitepress/theme/learnify-callout.js';

function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => typeof item === 'string'
    ? [[`${prefix}${key}`, item]] : leaves(item, `${prefix}${key}.`));
}

for (const [language, t] of Object.entries(translations)) {
  test(`${language}: dictionary covers every key and preserves placeholders`, () => {
    const source = leaves(translations.mk);
    const translated = leaves(t);
    assert.deepEqual(translated.map(([key]) => key), source.map(([key]) => key));
    translated.forEach(([key, value], index) => {
      assert.ok(value.trim(), key);
      assert.deepEqual(value.match(/\{\w+\}/gu), source[index][1].match(/\{\w+\}/gu), key);
    });
  });
}

function links(tokens) {
  const result = [];
  for (const token of tokens) {
    const children = token.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.type !== 'link_open' || child.attrGet('class') === 'header-anchor') continue;
      const label = [];
      for (let j = i + 1; j < children.length && children[j].type !== 'link_close'; j++) {
        label.push(children[j].content);
      }
      result.push({ href: child.attrGet('href'), label: label.join('') });
    }
  }
  return result;
}
const anchors = (tokens) => tokens.filter((token) => token.type === 'heading_open').map((token) => token.attrGet('id'));

test('all translated course and introduction pages preserve every source link and anchor', async () => {
  const renderer = await createMarkdownRenderer(contentRoot);
  const sources = sourcePages();
  for (const path of sources.filter((path) => path !== 'index.md')) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const original = renderer.parse(source, {});
    for (const language of ['en', 'sq', 'tr']) {
      const localized = localizeMarkdown(source, path, language, renderer);
      const tokens = renderer.parse(localized, {});
      assert.deepEqual(links(tokens), links(original), `${language}/${path}: source link labels and destinations`);
      assert.deepEqual(anchors(tokens), anchors(original), `${language}/${path}: section IDs`);
      assert.ok(!localized.includes('{#undefined}'), `${language}/${path}`);
    }
    assert.equal(localizeMarkdown(source, path, 'mk', renderer), source);
  }
});

test('generation covers every source page in all three additional languages without copied content files', async () => {
  const pages = await localizedPages();
  const expected = sourcePages().flatMap((path) => ['en', 'sq', 'tr'].map((language) => `${language}/${path}`));
  assert.deepEqual(pages.map(({ params }) => `${params.locale}/${params.page}.md`), expected);
  assert.equal(new Set(expected).size, pages.length);
  for (const { params, content } of pages) {
    if (params.page.endsWith('strukturno-programiranje')) {
      assert.ok(content.includes(`## ${translations[params.locale].sections.lectures} {#предавања}`));
      assert.ok(content.includes('keywords:\n'));
    }
    if (params.page === 'index') assert.ok(content.includes(translations[params.locale].home.text));
    if (params.page === 'introduction') assert.ok(content.includes(translations[params.locale].introduction.description));
  }
});

test('locale routes preserve the course identity, query and fragment without stacking prefixes', () => {
  const route = '/courses/semester-1/strukturno-programiranje.html?view=all#предавања';
  for (const language of Object.keys(translations)) {
    const localized = localizedPath(route, language);
    assert.equal(stripLanguagePrefix(localized), route);
    assert.equal(languageFromPath(localized), language);
    assert.equal(localizedPath(`/tr${route}`, language), localized);
    assert.equal(shouldShowLearnifyCallout(localized.split('?')[0].replace(/\.html$/u, '.md')), true);
  }
  assert.equal(stripLanguagePrefix('/courses/en/notes.html'), '/courses/en/notes.html');
  assert.equal(localizedPath('/en/', 'mk'), '/');
});

test('preference validation rejects inherited keys and storage failures keep the UI usable', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    for (const value of [null, '', 'de', 'constructor', '__proto__', 1]) assert.equal(isLanguage(value), false);
    let saved = null;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => saved, setItem: (_key, value) => { saved = value; },
    } });
    assert.equal(readLanguagePreference(), 'mk');
    for (const language of Object.keys(translations)) {
      saveLanguagePreference(language);
      assert.equal(readLanguagePreference(), language);
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Blocked'); } });
    assert.equal(readLanguagePreference(), 'mk');
    assert.doesNotThrow(() => saveLanguagePreference('sq'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('localized metadata points to all language versions and locale home canonicals', () => {
  for (const language of Object.keys(translations)) {
    const prefix = language === 'mk' ? '' : `${language}/`;
    const tags = pageHeadTags(`${prefix}index.md`);
    const canonical = tags.find(([tag, attrs]) => tag === 'link' && attrs.rel === 'canonical')[1].href;
    assert.equal(canonical, `https://recordings.finki-hub.com/${prefix}`);
    assert.equal(tags.filter(([tag, attrs]) => tag === 'link' && attrs.rel === 'alternate').length, 4);
    assert.equal(tags.find(([, attrs]) => attrs.property === 'og:title')[1].content, translations[language].title);
  }
});
