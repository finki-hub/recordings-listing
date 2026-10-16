# FINKI Hub / Recordings Listing

A VitePress-powered website that aggregates links to lecture and exercise recordings for courses at FCSE. Each course has its own Markdown page and is available via the sidebar for quick navigation.

> Note: All rights to the recordings belong to their respective owners. Links are shared for educational purposes only.

## Features

- Course pages with structured links to recordings (by week/topic)
- Sidebar navigation to browse all courses
- Simple contribution flow via pull requests

## Prerequisites

- Node.js 24 or newer (LTS recommended)

## Setup

Clone the repository and install dependencies:

```sh
git clone https://github.com/finki-hub/recordings-listing.git
cd recordings-listing
npm install
```

## Scripts

Dev server (local preview with HMR):

```sh
npm run docs:dev
```

The terminal will display a local URL to open in your browser.

Build the static site:

```sh
npm run docs:build
```

The output is generated in `.vitepress/dist`.

Preview the production build locally:

```sh
npm run docs:preview
```

## Linting

TypeScript and Vue code use `eslint-config-imperium`, with its shared base,
browser, Node, TypeScript, Vue, Prettier and import-sorting configurations.

```sh
npm run check
npm run lint
npm run format
```

Strict type checking covers the theme, Vue components, VitePress and Playwright
configuration, generated route loader, build helpers and tests. The compiler
settings match the other FINKI Hub frontends, including unchecked indexed access,
unused code and missing return checks. Builds run type checking first.

Lint all Markdown files:

```cmd
npm run lint:md
```

Auto-fix what can be fixed:

```cmd
npm run lint:md:fix
```

Rules are configured in `.markdownlint.jsonc`. Build output and cache folders are ignored via `.markdownlintignore`.

Run both code and Markdown linting with `npm run lint:all`. CI runs both linters
and the type-checked production build. Unit and browser tests are written in
TypeScript and run with `npm test` and `npm run test:integration`.

## Project Structure

```text
.
├─ .vitepress/
│  └─ config.ts
├─ courses/
│  ├─ index.md
│  ├─ structural-programming.md
│  └─ ...
└─ index.md
```

## Adding a New Course Page

1. Create a new Markdown file in `courses/`, for example:
   - `courses/structucal-programming.md`
2. Add content: short intro + structured list of recordings and resources.
3. Add the page to the sidebar in `.vitepress/config.ts` so it appears in the UI:

```ts
// .vitepress/config.ts
export default defineConfig({
  // ...
  themeConfig: {
    // ...
    sidebar: [
      {
        text: "Преглед",
        items: [
          { text: "Предмети", link: "/courses/" },
          {
            text: "Структурно програмирање",
            link: "/courses/structural-programming",
          }, // New page
        ],
      },
    ],
  },
});
```

## Localization

The site supports Macedonian (the default), English, Albanian and Turkish.
Existing Macedonian URLs remain valid; the additional languages use `/en/`,
`/sq/` and `/tr/`. The header dropdown uses the same language names and visual
conventions as the other FINKI Hub sites, and saves preferences under
`finki-hub-lang`. An explicit localized URL selects that language; an unprefixed
page restores a saved preference after hydration. Blocked local storage leaves
route-based switching available.

Translations live in `.vitepress/locales/`; the Macedonian dictionary defines
the shared TypeScript shape in `.vitepress/i18n.ts`. New course pages still belong
in `courses/` and need to be maintained only once. The `[locale]/[page]` route
loader generates the additional language versions in development and production.
It translates recognized structural headings, standard notes, the homepage and
introduction while preserving original recording link labels and destinations,
course names, lecturer names, recording titles, search aliases and section IDs.
Site navigation links point to the corresponding localized pages.

Favorites retain their existing language-neutral course URLs in storage.
Language changes keep the current page, query and section. Local search uses
the selected language index and keeps the original course names and aliases.

Validate localization with `npm run check`, `npm test`, `npm run lint:md`,
`npm run docs:build` and `npm run test:integration`. The tests compare links and
anchors across every generated course page and exercise favorites, search,
metadata without JavaScript, language persistence and keyboard navigation.

## License

This project is licensed under the terms of the MIT license.
