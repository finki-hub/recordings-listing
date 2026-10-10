import { posthog } from 'posthog-js';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import LearnifyCourseCallout from './components/LearnifyCourseCallout.vue';
import { useFavorites } from './composables/useFavorites';
import { captureFavoritesFocus, restoreFavoritesFocus } from './favorites-focus.js';
import { needsFavoritesSidebarReconciliation } from './favorites-sidebar.js';
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

      const isEligibleFavoriteLink = (anchor) => {
        const href = anchor.getAttribute('href');
        return Boolean(href && href !== '#' &&
          !href.includes('/introduction') && !href.includes('/index') && href !== '/');
      };
      let isHydrated = false;
      let lastFocusedFavorite = null;
      const rememberFavoriteFocus = (event) => {
        const target = event.target;
        const favoriteButton = target.closest?.('button.favorite-star');
        const favoriteLink = target.closest?.('#favorites-section a[href]');
        if (favoriteButton?.dataset.favoriteLink) {
          lastFocusedFavorite = { link: favoriteButton.dataset.favoriteLink, control: 'favorite' };
        } else if (favoriteLink) {
          lastFocusedFavorite = { link: favoriteLink.getAttribute('href'), control: 'link' };
        }
      };
      const needsSidebarReconciliation = () => {
        const links = [...document.querySelectorAll('.VPSidebarItem a[href]')]
          .filter((anchor) => !anchor.closest('#favorites-section') && isEligibleFavoriteLink(anchor));
        if (!links.length) return false;

        const reconciliationLinks = links.map((anchor) => {
          const href = anchor.getAttribute('href');
          const item = anchor.closest('.item');
          const hasButton = item && [...item.querySelectorAll('.favorite-star')]
            .some((button) => button.dataset.favoriteLink === href);
          return { href, hasButton };
        });
        const hasFavorites = links.some((anchor) => isFavorite(anchor.getAttribute('href')));
        return needsFavoritesSidebarReconciliation(
          reconciliationLinks,
          hasFavorites,
          Boolean(document.querySelector('#favorites-section')),
        );
      };

      const injectStarsAndFavorites = () => {
        const sidebarLinks = document.querySelectorAll('.VPSidebarItem a[href]');
        if (sidebarLinks.length === 0) {
          return false;
        }

        sidebarLinks.forEach((anchor) => {
          const href = anchor.getAttribute('href');
          if (!isEligibleFavoriteLink(anchor)) {
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
        if (!isHydrated) return;
        document.querySelectorAll('.favorite-star').forEach((star) => {
          const link = star.dataset.favoriteLink;
          if (link) applyFavoriteState(star, link);
        });

        createFavoritesSection();
      };

      const createFavoritesSection = () => {
        const existingSection = document.querySelector('#favorites-section');
        const savedFocus = captureFavoritesFocus(existingSection, document.activeElement) ??
          (document.activeElement === document.body ? lastFocusedFavorite : null);
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
        headerText.textContent = 'Омилени';

        const favoriteCount = document.createElement('span');
        favoriteCount.className = 'favorites-count';
        favoriteCount.textContent = String(favoriteLinks.length);

        header.appendChild(indicator);
        header.appendChild(headerText);
        header.appendChild(favoriteCount);

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
      let reconciliationScheduled = false;
      let sidebarObserver;
      const reconcileAfterSidebarUpdate = () => {
        reconciliationScheduled = false;
        if (isHydrated && needsSidebarReconciliation()) injectStarsAndFavorites();
      };
      const initializeSidebarEnhancements = () => {
        if (isHydrated) return;
        isHydrated = true;

        document.addEventListener('focusin', rememberFavoriteFocus, true);
        sidebarObserver = new MutationObserver(() => {
          if (reconciliationScheduled) return;
          reconciliationScheduled = true;
          requestAnimationFrame(reconcileAfterSidebarUpdate);
        });
        const appRoot = document.getElementById('app');
        if (appRoot) sidebarObserver.observe(appRoot, { childList: true, subtree: true });

        injectStarsAndFavorites();
      };

      // Vue calls mounted on the root only after initial SSR hydration has finished.
      app.mixin({
        mounted() {
          if (this === this.$root) initializeSidebarEnhancements();
        },
      });

      app.onUnmount(() => {
        unsubscribeFavorites();
        sidebarObserver?.disconnect();
        if (isHydrated) document.removeEventListener('focusin', rememberFavoriteFocus, true);
        dispose();
      });

      const initWithRetry = () => {
        injectStarsAndFavorites();
      };

      router.onAfterRouteChange = () => {
        if (isHydrated) setTimeout(initWithRetry, 50);
      };
    }
  },
};
