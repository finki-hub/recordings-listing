import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { createMarkdownRenderer } from 'vitepress';

import {
  addFrontmatterKeywords,
  pageHeadTags,
} from '../.vitepress/site-audit.ts';
import viteConfig from '../vite.config.ts';
import { at } from './helpers.ts';

const htmlHeadingPattern =
  /<h(?<capture1>[1-6])\b[^>]*>(?<capture2>[\s\S]*?)<\/h\k<capture1>>/giu;
const hiddenAliasesPattern = /<div style="display:none">[\s\S]*?<\/div>/u;

const origin = 'https://recordings.finki-hub.com';

test('page head metadata follows generated .html routes without duplicate canonical or og:url tags', () => {
  const pages = [
    ['index.md', `${origin}/`],
    [
      'courses/semester-1/strukturno-programiranje.md',
      `${origin}/courses/semester-1/strukturno-programiranje.html`,
    ],
    ['courses/semester-1/index.md', `${origin}/courses/semester-1/index.html`],
  ] as const;

  for (const [relativePath, expectedUrl] of pages) {
    const tags = pageHeadTags(relativePath);
    const canonicals = tags.filter(
      ([tag, attrs]) => tag === 'link' && attrs['rel'] === 'canonical',
    );
    const ogUrls = tags.filter(
      ([tag, attrs]) => tag === 'meta' && attrs['property'] === 'og:url',
    );

    assert.equal(canonicals.length, 1, `${relativePath} has one canonical`);
    assert.equal(at(canonicals, 0)[1]['href'], expectedUrl);
    assert.equal(ogUrls.length, 1, `${relativePath} has one og:url`);
    assert.equal(at(ogUrls, 0)[1]['content'], expectedUrl);
  }
});

test('hidden frontmatter aliases are inserted after the page H1 and before later headings', async () => {
  const md = await createMarkdownRenderer(process.cwd(), {
    config: addFrontmatterKeywords,
  });
  const tokens = md.parse('# Course title\n\n## Lectures\n\n## Notes', {
    frontmatter: { keywords: ['oop', 'web programiranje'] },
  });

  const h1CloseIndex = tokens.findIndex(
    (token) => token.type === 'heading_close' && token.tag === 'h1',
  );
  const htmlIndex = h1CloseIndex + 1;
  const firstLaterHeading = tokens.findIndex(
    (token, index) => index > htmlIndex && token.type === 'heading_open',
  );

  assert.ok(h1CloseIndex !== -1, 'page H1 closing token exists');
  assert.equal(at(tokens, htmlIndex).type, 'html_block');
  assert.equal(
    at(tokens, htmlIndex).content,
    '<div style="display:none">oop web programiranje</div>',
  );
  assert.ok(
    htmlIndex < firstLaterHeading,
    'aliases precede lectures and notes headings',
  );
});

test('representative aliases belong to their course search sections, not Notes', async () => {
  const markdown = await createMarkdownRenderer(process.cwd(), {
    config: addFrontmatterKeywords,
  });
  const pages = [
    {
      alias: 'oop',
      path: 'courses/semester-2/objektno-orientirano-programiranje.md',
      title: 'Објектно-ориентирано програмирање',
    },
    {
      alias: 'web programiranje',
      path: 'courses/semester-5/veb-programiranje.md',
      title: 'Веб програмирање',
    },
    {
      alias: 'strukturno programiranje',
      path: 'courses/semester-1/strukturno-programiranje.md',
      title: 'Структурно програмирање',
    },
    {
      alias: 'aps',
      path: 'courses/semester-3/algoritmi-i-podatochni-strukturi.md',
      title: 'Алгоритми и податочни структури',
    },
  ];

  for (const page of pages) {
    const source = await readFile(resolve(page.path), 'utf8');
    const html = await markdown.renderAsync(source, {
      relativePath: page.path,
    });
    const headings = html.matchAll(htmlHeadingPattern).toArray();
    const searchSections = headings.map((heading, index) => {
      const contentStart = heading.index + heading[0].length;
      const nextHeadingStart = headings[index + 1]?.index ?? html.length;
      return {
        headingHtml: heading.at(2) ?? '',
        sectionHtml: html.slice(contentStart, nextHeadingStart).toLowerCase(),
      };
    });
    const courseSection = searchSections.find((section) =>
      section.headingHtml.includes(page.title),
    );
    const notesSection = searchSections.find((section) =>
      section.headingHtml.includes('Белешки'),
    );

    assert.ok(
      courseSection,
      `${page.path} has an indexed course-title section`,
    );
    assert.ok(
      courseSection.sectionHtml.includes(page.alias),
      `${page.alias} is searchable under its course`,
    );
    assert.ok(notesSection, `${page.path} has a Notes section`);
    assert.ok(
      !notesSection.sectionHtml.includes(page.alias),
      `${page.alias} is not assigned to Notes`,
    );
    assert.match(
      html,
      hiddenAliasesPattern,
      'aliases stay hidden in rendered UI',
    );
  }
});

test('Vite dev server keeps the default allowed-host checks', () => {
  assert.equal(viteConfig.server?.allowedHosts, undefined);
});
