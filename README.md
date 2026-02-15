# FINKI Hub / Recordings Listing

A VitePress-powered website that aggregates links to lecture and exercise recordings for courses at FCSE. Each course has its own Markdown page and is available via the sidebar for quick navigation.

> Note: All rights to the recordings belong to their respective owners. Links are shared for educational purposes only.

## Features

- Course pages with structured links to recordings (by week/topic)
- Sidebar navigation to browse all courses
- Simple contribution flow via pull requests

## Prerequisites

- Node.js 20+ (LTS recommended)

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

Lint all Markdown files:

```cmd
npm run lint:md
```

Auto-fix what can be fixed:

```cmd
npm run lint:md:fix
```

Rules are configured in `.markdownlint.jsonc`. Build output and cache folders are ignored via `.markdownlintignore`.

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

## Deployment

- Any static host works (GitHub Pages, Netlify, Vercel, etc.).
- Build with `npm run docs:build` and deploy the `.vitepress/dist` directory.
- For GitHub Pages under a repository subpath, set the `base` option in `.vitepress/config.ts` to `'/<repo-name>/'`.

### Docker / Compose

Local build and run (builds from Dockerfile):

```cmd
docker compose -f compose.yaml up --build
```

Production run (pulls from GHCR):

```cmd
docker login ghcr.io
docker compose -f compose.prod.yaml up -d
```

The site will be available at <http://localhost:8080>

Notes:

- `compose.yaml` builds an image and tags it as `ghcr.io/finki-hub/recordings-listing:local`.
- `compose.prod.yaml` pulls `ghcr.io/finki-hub/recordings-listing:latest` (set in CI). If you tag images differently (e.g., by commit SHA), adjust the image in `compose.prod.yaml` accordingly.

## License

This project is licensed under the terms of the MIT license.
