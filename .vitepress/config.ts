import { defineConfig, UserConfig } from "vitepress";
import { withSidebar } from "vitepress-sidebar";

import type { VitePressSidebarOptions } from "vitepress-sidebar/types";

const vitePressOptions: UserConfig = {
  lang: "mk",
  title: "ФИНКИ Хаб / Снимки",
  description: "Колекција од снимки од предмети на ФИНКИ",
  // Exclude the repository README from being compiled as a page
  srcExclude: ["README.md"],
  markdown: {
    config: (md) => {
      md.core.ruler.push("frontmatter-keywords", (state) => {
        const env: any = state.env || {};
        const keywords: unknown = env.frontmatter?.keywords;
        if (Array.isArray(keywords) && keywords.length > 0) {
          // Append a hidden HTML block so the terms are indexed by local search
          // without authors needing to place HTML in the Markdown.
          const token = new (state as any).Token("html_block", "", 0);
          token.content = `<div style="display:none">${keywords.join(
            " "
          )}</div>`;
          state.tokens.push(token);
        }
        return true;
      });
    },
  },
  head: [
    // Google Fonts (Inter + JetBrains Mono)
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap' }],

    // Favicons
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],

    // SEO
    ['meta', { name: 'author', content: 'ФИНКИ Хаб' }],
    ['meta', { name: 'theme-color', content: '#0a0a0a' }],

    // Open Graph
    ['meta', { property: 'og:title', content: 'ФИНКИ Хаб / Снимки' }],
    ['meta', { property: 'og:description', content: 'Колекција од снимки од предмети на ФИНКИ.' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: 'https://recordings.finki-hub.com' }],
    ['meta', { property: 'og:locale', content: 'mk_MK' }],
    ['meta', { property: 'og:image', content: 'https://recordings.finki-hub.com/favicon-96x96.png' }],

    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'ФИНКИ Хаб / Снимки' }],
    ['meta', { name: 'twitter:description', content: 'Колекција од снимки од предмети на ФИНКИ.' }],
    ['meta', { name: 'twitter:image', content: 'https://recordings.finki-hub.com/favicon-96x96.png' }],

    // Canonical
    ['link', { rel: 'canonical', href: 'https://recordings.finki-hub.com' }],
  ],
  themeConfig: {
    nav: [
      { text: "Дома", link: "/" },
      { text: "Вовед", link: "/introduction" },
    ],
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "Пребарај",
                buttonAriaLabel: "Пребарај",
              },
              modal: {
                noResultsText: "Нема резултати",
                resetButtonTitle: "Исчисти пребарување",
                displayDetails: "Прикажи детали",
                backButtonTitle: "Назад",
                footer: {
                  selectText: "избери",
                  navigateText: "движи се",
                  closeText: "затвори",
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/finki-hub/recordings-listing",
      },
    ],
    sidebarMenuLabel: "Мени",
    returnToTopLabel: "Врати се на врвот",
    darkModeSwitchLabel: "Тема",
    lightModeSwitchTitle: "Светла тема",
    darkModeSwitchTitle: "Темна тема",
    skipToContentLabel: "Прескокни до содржина",
    outline: {
      label: "Содржина",
    },
    docFooter: {
      prev: false,
      next: false,
    },
    footer: {
      message:
        "Ова е неофицијална страница. Линковите до снимки се јавни; не поседуваме ниту хостираме снимки. Сите авторски права припаѓаат на ФИНКИ. ",
    },
  },
};

const vitePressSidebarOptions: VitePressSidebarOptions = {
  excludeByGlobPattern: ["README.md"],
  includeRootIndexFile: false,
  manualSortFileNameByPriority: ["introduction.md"],
  useFolderTitleFromIndexFile: true,
  useTitleFromFileHeading: true,
  useTitleFromFrontmatter: true,
};

export default defineConfig(
  withSidebar(vitePressOptions, vitePressSidebarOptions)
);
