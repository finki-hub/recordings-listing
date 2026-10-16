import type { MarkdownEnv, MarkdownRenderer } from 'vitepress';

import { slugify } from '@mdit-vue/shared';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  type Language,
  languageFromPath,
  localizedPath,
  stripLanguagePrefix,
  translations,
} from './i18n.ts';

const markdownExtensionPattern = /\.md$/u;
const sourceHeadingPattern =
  /^#{1,6} (?<capture2>.+?)(?: \{#(?<capture3>[^}]+)\})?$/u;
const translatedHeadingPattern =
  /^(?<capture1>#{1,6}) (?<capture2>.+?)(?: \{#[^}]+\})?$/u;
const semesterTitlePattern = /^title: Семестар (?<capture1>\d+)$/u;

const collator = new Intl.Collator();

export const contentRoot = fileURLToPath(new URL('../', import.meta.url));
export const sourcePages = () =>
  globSync(['index.md', 'introduction.md', 'courses/**/*.md'], {
    cwd: contentRoot,
  }).sort(collator.compare);

export const homeFrontmatter = (language: Language) => {
  const t = translations[language].home;
  return {
    features: [
      { details: t.coursesDetails, title: t.coursesTitle },
      { details: t.navigationDetails, title: t.navigationTitle },
      { details: t.linksDetails, title: t.linksTitle },
    ],
    hero: {
      actions: [
        {
          link: localizedPath('/introduction', language),
          text: t.browse,
          theme: 'brand',
        },
        {
          link: localizedPath('/introduction#придонесете', language),
          text: t.contribute,
          theme: 'alt',
        },
      ],
      tagline: t.tagline,
      text: t.text,
    },
    layout: 'home',
  };
};

// Translate complete structural strings only. Recording link labels, URLs,
// unlinked recording titles, course names, people and explicit IDs remain source data.
export const localizeMarkdown = (
  source: string,
  relativePath: string,
  language: Language,
) => {
  if (language === 'mk') return source;
  if (relativePath === 'index.md') {
    const data = homeFrontmatter(language);
    return `---\nlayout: home\nhero: ${JSON.stringify(data.hero)}\nfeatures: ${JSON.stringify(data.features)}\n---\n`;
  }

  const t = translations[language];
  const mk = translations.mk;
  const prose = new Map([
    ...Object.entries(mk.introduction).map(
      ([key, value]) =>
        [value, t.introduction[key as keyof typeof mk.introduction]] as const,
    ),
    ...Object.entries(mk.notes).map(
      ([key, value]) => [value, t.notes[key as keyof typeof mk.notes]] as const,
    ),
  ]);
  const headings = new Map([
    ...Object.entries(mk.sections).map(
      ([key, value]) =>
        [value, t.sections[key as keyof typeof mk.sections]] as const,
    ),
    ...Object.entries(mk.introduction)
      .filter(([key]) => key.endsWith('Heading'))
      .map(
        ([key, value]) =>
          [value, t.introduction[key as keyof typeof mk.introduction]] as const,
      ),
  ]);
  const headingIds = new Map<number, string>();
  const usedIds = new Set<string>();
  // Use VitePress's slugifier without initializing its process-wide renderer.
  // The real renderer must be created by VitePress with the site's own plugins.
  for (const [index, line] of source.split('\n').entries()) {
    const heading = sourceHeadingPattern.exec(line);
    if (!heading?.at(1)) continue;
    const base = heading.at(2) ?? slugify(heading.at(1) ?? '');
    let id = base;
    let suffix = 1;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    headingIds.set(index, id);
  }

  return source
    .split('\n')
    .map((line, index) => {
      const heading = translatedHeadingPattern.exec(line);
      const title = heading?.at(2);
      if (title && heading && headings.has(title)) {
        return `${heading.at(1)} ${headings.get(title)} {#${headingIds.get(index)}}`;
      }
      if (line === 'title: Вовед')
        return `title: ${JSON.stringify(t.nav.introduction)}`;
      if (line === 'title: Предмети')
        return `title: ${JSON.stringify(t.courses)}`;
      const semester = semesterTitlePattern.exec(line);
      if (semester?.at(1))
        return `title: ${JSON.stringify(t.semester.replace('{number}', () => semester.at(1) ?? ''))}`;
      if (line === `::: tip ${mk.introduction.startTitle}`)
        return `::: tip ${t.introduction.startTitle}`;
      if (line === `- **${mk.notes.none}**`) return `- **${t.notes.none}**`;
      return line.startsWith('- ') && prose.has(line.slice(2))
        ? `- ${prose.get(line.slice(2))}`
        : (prose.get(line) ?? line);
    })
    .join('\n');
};

export const localizedPages = () =>
  sourcePages().flatMap((path) => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    return (['en', 'sq', 'tr'] as const).map((locale) => ({
      content: localizeMarkdown(source, path, locale),
      params: { locale, page: path.replace(markdownExtensionPattern, '') },
    }));
  });

// VitePress local search reads physical files before invoking this hook. Supply
// generated Markdown from the same canonical source used by the route loader.
export const renderSearchPage = async (
  source: string,
  env: MarkdownEnv,
  renderer: MarkdownRenderer,
) => {
  const language = languageFromPath(env.relativePath);
  let markdown = source;
  if (!source && language !== 'mk') {
    const canonical = stripLanguagePrefix(env.relativePath);
    if (!sourcePages().includes(canonical)) return '';
    const original = readFileSync(
      new URL(`../${canonical}`, import.meta.url),
      'utf8',
    );
    markdown = localizeMarkdown(original, canonical, language);
  }
  const html = await renderer.renderAsync(markdown, env);
  return env.frontmatter?.['search'] === false ? '' : html;
};
