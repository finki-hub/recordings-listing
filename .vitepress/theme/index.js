import { posthog } from 'posthog-js';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import { useFavorites } from './composables/useFavorites';
import './custom.css';
import './style.css';

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ??
  'phc_xXEqLMnYeDPuXA6HHwuasQMdSufDGryS8vZZuHmu9Qwd';
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {});
  },
  enhanceApp({ app, router }) {
    if (typeof window !== 'undefined') {
      if (POSTHOG_KEY) {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          autocapture: true,
          person_profiles: 'always',
          capture_exceptions: true,
        });
      }

      // Search analytics — hooks into VitePress built-in local search
      const initSearchAnalytics = () => {
        let debounceTimer = null;
        let attached = false;

        const fireSearchSettle = () => {
          const input = document.querySelector('.VPLocalSearchBox input');
          const query = (input?.value ?? '').trim();
          if (!query) return;

          const resultItems = document.querySelectorAll('.VPLocalSearchBox .result');
          const result_count = resultItems.length;

          posthog.capture('catalog_search', { query, result_count });
          if (result_count === 0) posthog.capture('search_zero_results', { query });
        };

        const onInput = () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(fireSearchSettle, 500);
        };

        const onResultClick = (e) => {
          const resultEl = e.target.closest('.result');
          if (!resultEl) return;

          const allResults = [...document.querySelectorAll('.VPLocalSearchBox .result')];
          const position = allResults.indexOf(resultEl);
          const link = resultEl.querySelector('a[href]');
          const result_id = link?.getAttribute('href') ?? '';

          posthog.capture('result_clicked', { position, result_id });
        };

        const tryAttach = () => {
          const searchBox = document.querySelector('.VPLocalSearchBox');
          if (searchBox && !attached) {
            attached = true;
            const input = searchBox.querySelector('input');
            if (input) input.addEventListener('input', onInput);
            searchBox.addEventListener('click', onResultClick);
          } else if (!searchBox && attached) {
            attached = false;
            clearTimeout(debounceTimer);
          }
        };

        const bodyObserver = new MutationObserver(tryAttach);
        bodyObserver.observe(document.body, { childList: true, subtree: false });
      };

      if (POSTHOG_KEY) {
        initSearchAnalytics();
      }

      const injectStarsAndFavorites = () => {
        const { isFavorite, toggleFavorite } = useFavorites();

        const sidebarLinks = document.querySelectorAll('.VPSidebarItem a[href]');
        if (sidebarLinks.length === 0) {
          return false;
        }

        sidebarLinks.forEach((anchor) => {
          const href = anchor.getAttribute('href');
          if (!href || href === '#' || href === '' ||
              href.includes('/introduction') || href.includes('/index') || href === '/') {
            return;
          }

          if (anchor.querySelector('.favorite-star')) return;

          const star = document.createElement('span');
          star.className = 'favorite-star' + (isFavorite(href) ? ' active' : '');
          star.innerHTML = isFavorite(href) ? '★' : '☆';
          star.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(href);
            updateAllStarsAndFavorites();
          };

          anchor.appendChild(star);
        });

        createFavoritesSection();
        return true;
      };

      const updateAllStarsAndFavorites = () => {
        const { isFavorite } = useFavorites();

        document.querySelectorAll('.favorite-star').forEach((star) => {
          const anchor = star.parentElement;
          const href = anchor?.getAttribute('href');
          if (href) {
            const active = isFavorite(href);
            star.className = 'favorite-star' + (active ? ' active' : '');
            star.innerHTML = active ? '★' : '☆';
          }
        });

        createFavoritesSection();
      };

      const createFavoritesSection = () => {
        const { isFavorite } = useFavorites();

        const existingSection = document.querySelector('#favorites-section');
        if (existingSection) {
          existingSection.remove();
        }

        const favoriteLinks = [];
        document.querySelectorAll('.VPSidebarItem a[href]').forEach((anchor) => {
          const href = anchor.getAttribute('href');
          if (href && isFavorite(href) &&
              !href.includes('/introduction') && !href.includes('/index') && href !== '/') {
            const item = anchor.closest('.VPSidebarItem');
            if (item && !item.closest('#favorites-section')) {
              favoriteLinks.push({ item, href });
            }
          }
        });

        if (favoriteLinks.length === 0) return;

        let sidebar = document.querySelector('.VPSidebar nav');
        if (!sidebar) {
          sidebar = document.querySelector('.VPSidebar .nav');
        }
        if (!sidebar) {
          sidebar = document.querySelector('.VPSidebar .content');
        }
        if (!sidebar) {
          sidebar = document.querySelector('.VPSidebar > div:not(.curtain)');
        }
        if (!sidebar) {
          const sidebarEl = document.querySelector('.VPSidebar');
          if (sidebarEl) {
            const children = Array.from(sidebarEl.children);
            sidebar = children.find(child =>
              child.classList.contains('VPSidebarItem') ||
              child.querySelector('.VPSidebarItem')
            );
            if (!sidebar) {
              sidebar = children.find(child => !child.classList.contains('curtain'));
            }
          }
        }
        if (!sidebar) return;

        const favSection = document.createElement('div');
        favSection.id = 'favorites-section';
        favSection.className = 'VPSidebarItem level-0 has-children is-active';

        const header = document.createElement('div');
        header.className = 'item';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');

        const indicator = document.createElement('div');
        indicator.className = 'indicator';

        const headerText = document.createElement('p');
        headerText.className = 'text';
        headerText.textContent = '⭐ Омилени';

        header.appendChild(indicator);
        header.appendChild(headerText);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'items';

        favoriteLinks.forEach(({ item, href }) => {
          const clone = item.cloneNode(true);

          const cloneLink = clone.querySelector('a[href]');
          if (cloneLink) {
            const cloneStar = cloneLink.querySelector('.favorite-star');
            if (cloneStar) {
              cloneStar.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const href = cloneLink.getAttribute('href');
                if (href) {
                  const { toggleFavorite } = useFavorites();
                  toggleFavorite(href);
                  updateAllStarsAndFavorites();
                }
              };
            }
          }

          itemsContainer.appendChild(clone);
        });

        favSection.appendChild(header);
        favSection.appendChild(itemsContainer);

        const firstChild = sidebar.firstElementChild;
        if (firstChild) {
          sidebar.insertBefore(favSection, firstChild);
        } else {
          sidebar.appendChild(favSection);
        }
      };

      const initWithRetry = () => {
        if (!injectStarsAndFavorites()) {
          const observer = new MutationObserver(() => {
            if (injectStarsAndFavorites()) {
              observer.disconnect();
            }
          });

          const app = document.getElementById('app');
          if (app) {
            observer.observe(app, { childList: true, subtree: true });
          }

          setTimeout(() => {
            observer.disconnect();
          }, 5000);
        }
      };

      router.onAfterRouteChange = () => {
        if (POSTHOG_KEY) posthog.capture('$pageview');
        setTimeout(initWithRetry, 50);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWithRetry);
      } else {
        setTimeout(initWithRetry, 0);
      }
    }
  },
};
