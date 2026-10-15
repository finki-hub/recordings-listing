import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slugify } from '@mdit-vue/shared';
import { languageFromPath, localizedPath, stripLanguagePrefix, translations } from './i18n.ts';

export const contentRoot = fileURLToPath(new URL('../', import.meta.url));
export const sourcePages = () => globSync(['index.md', 'introduction.md', 'courses/**/*.md'], { cwd: contentRoot }).sort();

export function homeFrontmatter(language) {
  const t = translations[language].home;
  return {
    layout: 'home',
    hero: {
      text: t.text, tagline: t.tagline,
      actions: [
        { theme: 'brand', text: t.browse, link: localizedPath('/introduction', language) },
        { theme: 'alt', text: t.contribute, link: localizedPath('/introduction#придонесете', language) },
      ],
    },
    features: [
      { title: t.coursesTitle, details: t.coursesDetails },
      { title: t.navigationTitle, details: t.navigationDetails },
      { title: t.linksTitle, details: t.linksDetails },
    ],
  };
}

// Translate complete structural strings only. Recording link labels, URLs,
// unlinked recording titles, course names, people and explicit IDs remain source data.
export function localizeMarkdown(source, relativePath, language) {
  if (language === 'mk') return source;
  const t = translations[language];
  const mk = translations.mk;
  if (relativePath === 'index.md') {
    const data = homeFrontmatter(language);
    return `---\nlayout: home\nhero: ${JSON.stringify(data.hero)}\nfeatures: ${JSON.stringify(data.features)}\n---\n`;
  }

  const prose = new Map([
    ...Object.entries(mk.introduction).map(([key, value]) => [value, t.introduction[key]]),
    ...Object.entries(mk.notes).map(([key, value]) => [value, t.notes[key]]),
  ]);
  const headings = new Map([
    ...Object.entries(mk.sections).map(([key, value]) => [value, t.sections[key]]),
    ...Object.entries(mk.introduction).filter(([key]) => key.endsWith('Heading')).map(([key, value]) => [value, t.introduction[key]]),
  ]);
  const headingIds = new Map();
  const usedIds = new Set();
  // Use VitePress's slugifier without initializing its process-wide renderer.
  // The real renderer must be created by VitePress with the site's own plugins.
  source.split('\n').forEach((line, index) => {
    const heading = /^(#{1,6}) (.+?)(?: \{#([^}]+)\})?$/u.exec(line);
    if (!heading) return;
    const base = heading[3] ?? slugify(heading[2]);
    let id = base;
    for (let suffix = 1; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
    usedIds.add(id);
    headingIds.set(index, id);
  });

  return source.split('\n').map((line, index) => {
    const heading = /^(#{1,6}) (.+?)(?: \{#[^}]+\})?$/u.exec(line);
    if (heading && headings.has(heading[2])) {
      return `${heading[1]} ${headings.get(heading[2])} {#${headingIds.get(index)}}`;
    }
    if (line === 'title: Вовед') return `title: ${JSON.stringify(t.nav.introduction)}`;
    if (line === 'title: Предмети') return `title: ${JSON.stringify(t.courses)}`;
    const semester = /^title: Семестар (\d+)$/u.exec(line);
    if (semester) return `title: ${JSON.stringify(t.semester.replace('{number}', semester[1]))}`;
    if (line === `::: tip ${mk.introduction.startTitle}`) return `::: tip ${t.introduction.startTitle}`;
    if (line === `- **${mk.notes.none}**`) return `- **${t.notes.none}**`;
    if (line.startsWith('- ') && prose.has(line.slice(2))) return `- ${prose.get(line.slice(2))}`;
    return prose.get(line) ?? line;
  }).join('\n');
}

export function localizedPages() {
  return sourcePages().flatMap((path) => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    return ['en', 'sq', 'tr'].map((locale) => ({
      params: { locale, page: path.replace(/\.md$/u, '') },
      content: localizeMarkdown(source, path, locale),
    }));
  });
}

// VitePress local search reads physical files before invoking this hook. Supply
// generated Markdown from the same canonical source used by the route loader.
export async function renderSearchPage(source, env, renderer) {
  const language = languageFromPath(env.relativePath);
  if (!source && language !== 'mk') {
    const canonical = stripLanguagePrefix(env.relativePath);
    if (!sourcePages().includes(canonical)) return '';
    const original = readFileSync(new URL(`../${canonical}`, import.meta.url), 'utf8');
    source = localizeMarkdown(original, canonical, language);
  }
  const html = await renderer.renderAsync(source, env);
  return env.frontmatter?.search === false ? '' : html;
}
