import type Token from 'markdown-it/lib/token.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMarkdownRenderer } from 'vitepress';

import {
  isLanguage,
  languageFromPath,
  localizedPath,
  readLanguagePreference,
  saveLanguagePreference,
  stripLanguagePrefix,
  translations,
} from '../.vitepress/i18n.ts';
import {
  contentRoot,
  localizedPages,
  localizeMarkdown,
  sourcePages,
} from '../.vitepress/localized-content.ts';
import { pageHeadTags } from '../.vitepress/site-audit.ts';
import { shouldShowLearnifyCallout } from '../.vitepress/theme/learnify-callout.ts';
import { at } from './helpers.ts';

const placeholderPattern = /\{\w+\}/gu;
const htmlExtensionPattern = /\.html$/u;

const leaves = (value: object, prefix = ''): Array<[string, string]> =>
  (Object.entries(value) as Array<[string, unknown]>).flatMap(([key, item]) => {
    if (typeof item === 'string')
      return [[`${prefix}${key}`, item] as [string, string]];
    return typeof item === 'object' && item !== null
      ? leaves(item, `${prefix}${key}.`)
      : [];
  });
const languages = Object.keys(translations).filter(isLanguage);

for (const [language, t] of Object.entries(translations)) {
  test(`${language}: dictionary covers every key and preserves placeholders`, () => {
    const source = leaves(translations.mk);
    const translated = leaves(t);
    assert.deepEqual(
      translated.map(([key]) => key),
      source.map(([key]) => key),
    );
    for (const [index, [key, value]] of translated.entries()) {
      assert.ok(value.trim(), key);
      assert.deepEqual(
        value.match(placeholderPattern),
        at(source, index)[1].match(placeholderPattern),
        key,
      );
    }
  });
}

const links = (tokens: Token[]) => {
  const result: Array<{ href: null | string; label: string }> = [];
  for (const token of tokens) {
    const children = token.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = at(children, i);
      if (
        child.type !== 'link_open' ||
        child.attrGet('class') === 'header-anchor'
      )
        continue;
      const label: string[] = [];
      for (
        let j = i + 1;
        j < children.length && at(children, j).type !== 'link_close';
        j++
      ) {
        label.push(at(children, j).content);
      }
      result.push({ href: child.attrGet('href'), label: label.join('') });
    }
  }
  return result;
};
const anchors = (tokens: Token[]) =>
  tokens
    .filter((token) => token.type === 'heading_open')
    .map((token) => token.attrGet('id'));

test('all translated course and introduction pages preserve every source link and anchor', async () => {
  const renderer = await createMarkdownRenderer(contentRoot);
  const sources = sourcePages();
  for (const path of sources) {
    if (path === 'index.md') continue;
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const original = renderer.parse(source, {});
    for (const language of ['en', 'sq', 'tr'] as const) {
      const localized = localizeMarkdown(source, path, language);
      const tokens = renderer.parse(localized, {});
      assert.deepEqual(
        links(tokens),
        links(original),
        `${language}/${path}: source link labels and destinations`,
      );
      assert.deepEqual(
        anchors(tokens),
        anchors(original),
        `${language}/${path}: section IDs`,
      );
      assert.ok(!localized.includes('{#undefined}'), `${language}/${path}`);
    }
    assert.equal(localizeMarkdown(source, path, 'mk'), source);
  }
});

test('generation covers every source page in all three additional languages without copied content files', () => {
  const pages = localizedPages();
  const expected = sourcePages().flatMap((path) =>
    (['en', 'sq', 'tr'] as const).map((language) => `${language}/${path}`),
  );
  assert.deepEqual(
    pages.map(({ params }) => `${params.locale}/${params.page}.md`),
    expected,
  );
  assert.equal(new Set(expected).size, pages.length);
  for (const { content, params } of pages) {
    if (params.page.endsWith('strukturno-programiranje')) {
      assert.ok(
        content.includes(
          `## ${translations[params.locale].sections.lectures} {#предавања}`,
        ),
      );
      assert.ok(content.includes('keywords:\n'));
    } else if (params.page === 'index')
      assert.ok(content.includes(translations[params.locale].home.text));
    if (params.page === 'introduction')
      assert.ok(
        content.includes(translations[params.locale].introduction.description),
      );
  }
});

test('locale routes preserve the course identity, query and fragment without stacking prefixes', () => {
  const route =
    '/courses/semester-1/strukturno-programiranje.html?view=all#предавања';
  for (const language of languages) {
    const localized = localizedPath(route, language);
    assert.equal(stripLanguagePrefix(localized), route);
    assert.equal(languageFromPath(localized), language);
    assert.equal(localizedPath(`/tr${route}`, language), localized);
    assert.equal(
      shouldShowLearnifyCallout(
        at(localized.split('?', 1), 0).replace(htmlExtensionPattern, '.md'),
      ),
      true,
    );
  }
  assert.equal(
    stripLanguagePrefix('/courses/en/notes.html'),
    '/courses/en/notes.html',
  );
  assert.equal(localizedPath('/en/', 'mk'), '/');
});

test('preference validation rejects inherited keys and storage failures keep the UI usable', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    for (const value of [null, '', 'de', 'constructor', '__proto__', 1])
      assert.equal(isLanguage(value), false);
    let saved: null | string = null;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => saved,
        setItem: (_key: string, value: string) => {
          saved = value;
        },
      },
    });
    assert.equal(readLanguagePreference(), 'mk');
    for (const language of languages) {
      saveLanguagePreference(language);
      assert.equal(readLanguagePreference(), language);
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('Blocked');
      },
    });
    assert.equal(readLanguagePreference(), 'mk');
    assert.doesNotThrow(() => {
      saveLanguagePreference('sq');
    });
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('localized metadata points to all language versions and locale home canonicals', () => {
  for (const language of languages) {
    const prefix = language === 'mk' ? '' : `${language}/`;
    const tags = pageHeadTags(`${prefix}index.md`);
    const canonicalTag = tags.find(
      ([tag, attrs]) => tag === 'link' && attrs['rel'] === 'canonical',
    );
    assert.ok(canonicalTag);
    const canonical = canonicalTag[1]['href'];
    assert.equal(canonical, `https://recordings.finki-hub.com/${prefix}`);
    assert.equal(
      tags.filter(
        ([tag, attrs]) => tag === 'link' && attrs['rel'] === 'alternate',
      ).length,
      4,
    );
    assert.equal(
      tags.find(([, attrs]) => attrs['property'] === 'og:title')?.[1][
        'content'
      ],
      translations[language].title,
    );
  }
});
