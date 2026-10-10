import { posthog } from 'posthog-js';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import LearnifyCourseCallout from './components/LearnifyCourseCallout.vue';
import { useFavorites } from './composables/useFavorites';
import { captureFavoritesFocus, restoreFavoritesFocus } from './favorites-focus.js';
import { initAnalytics } from './analytics.js';
import { attachSearchAnalytics } from './search-analytics.js';
import './custom.css';
import './style.css';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(LearnifyCourseCallout),
    });
  },
  enhanceApp({ app, router }) {
    if (typeof window !== 'undefined') {
      const { isFavorite, toggleFavorite, subscribe, dispose } = useFavorites();

      if (POSTHOG_KEY) {
        const capture = initAnalytics(posthog, POSTHOG_KEY, POSTHOG_HOST);
        const disposeAnalytics = attachSearchAnalytics(capture);
        app.onUnmount(disposeAnalytics);
      }

      const applyFavoriteState = (button, link) => {
        const active = isFavorite(link);
        button.classList.toggle('active', active);
        button.textContent = active ? '★' : '☆';
        button.setAttribute('aria-label', active ? 'Отстрани од омилени' : 'Додади во омилени');
        button.setAttribute('title', active ? 'Отстрани од омилени' : 'Додади во омилени');
        button.setAttribute('aria-pressed', String(active));
      };

      const handleFavoriteClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const link = event.currentTarget.dataset.favoriteLink;
        if (link) toggleFavorite(link);
      };

      const injectStarsAndFavorites = () => {
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

          if (anchor.closest('#favorites-section')) return;
          const item = anchor.closest('.item');
          if (!item) return;

          let button = [...item.querySelectorAll('.favorite-star')]
            .find((candidate) => candidate.dataset.favoriteLink === href);
          if (button) return;

          button = document.createElement('button');
          button.type = 'button';
          button.className = 'favorite-star';
          button.dataset.favoriteLink = href;
          button.addEventListener('click', handleFavoriteClick);
          applyFavoriteState(button, href);
          anchor.insertAdjacentElement('afterend', button);
        });

        createFavoritesSection();
        return true;
      };

      const updateAllStarsAndFavorites = () => {
        document.querySelectorAll('.favorite-star').forEach((star) => {
          const link = star.dataset.favoriteLink;
          if (link) applyFavoriteState(star, link);
        });

        createFavoritesSection();
      };

      const createFavoritesSection = () => {
        const existingSection = document.querySelector('#favorites-section');
        const savedFocus = captureFavoritesFocus(existingSection, document.activeElement);
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

        if (favoriteLinks.length === 0) {
          restoreFavoritesFocus(document, savedFocus);
          return;
        }

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

          const cloneStar = clone.querySelector('.favorite-star');
          if (cloneStar) cloneStar.addEventListener('click', handleFavoriteClick);

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

        restoreFavoritesFocus(document, savedFocus);
      };

      const unsubscribeFavorites = subscribe(updateAllStarsAndFavorites);
      app.onUnmount(() => {
        unsubscribeFavorites();
        dispose();
      });

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
