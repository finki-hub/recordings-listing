# FINKI Hub / Recordings Listing

A VitePress-powered website that aggregates links to lecture and exercise recordings for courses at FCSE. Each course has its own Markdown page and is available via the sidebar for quick navigation.

> Note: All rights to the recordings belong to their respective owners. Links are shared for educational purposes only.

## Features

- Course pages with structured links to recordings (by week/topic)
- Sidebar navigation to browse all courses
- Simple contribution flow via pull requests

## Prerequisites

- Node.js 22.12 or newer (Node.js 24 LTS is recommended and tested).

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

The shipped Docker image keeps analytics disabled. `VITE_POSTHOG_*` values are
frontend build-time settings and are not nginx runtime variables. `.env*` files
are intentionally excluded from the Docker build context; do not expect runtime
container environment variables to enable analytics.

Preview the production build locally:

```sh
npm run docs:preview
```

## Testing

Run the fast Node unit tests with `npm test`. Built-site browser tests are a
separate lane:

```sh
node node_modules/@playwright/test/cli.js install chromium
npm run test:integration
```

The integration runner builds once with a dummy analytics token, then owns a
loopback-only preview on port 4187 (the usual preview on 4173 is not reused).
Vite serves the VitePress-built output because this VitePress version's preview
CLI does not support a loopback host option.
It tests real favorites/sidebar hydration, built metadata and Learnify rendering,
local-search alias results, and intercepted SDK telemetry. Analytics requests
never leave the browser: the dummy loopback endpoint is intercepted before load.
Only the telemetry fixture disables automated-browser bot hints, which the SDK
otherwise suppresses; the production SDK and privacy filter are not mocked.
Chromium runs with one worker and no retries; failed runs retain screenshots and
traces in `.playwright/results/`. Preview processes are stopped on success or
failure. CI uses the organization's reusable Playwright workflow; an `Integration`
gate preserves the required check and fails unless Playwright succeeds. The
reusable workflow does not currently upload failure traces or screenshots; these
remain available from local runs. The existing unit job remains separate.

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

## License

This project is licensed under the terms of the MIT license.
