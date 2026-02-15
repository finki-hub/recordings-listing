import { defineConfig, UserConfig } from "vitepress";
import { withSidebar } from "vitepress-sidebar";

import type { VitePressSidebarOptions } from "vitepress-sidebar/types";

const vitePressOptions: UserConfig = {
  lang: "mk",
  title: "ФИНКИ СНИМКИ",
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
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
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
