import type { Theme } from 'vitepress';
import type { ComponentPublicInstance } from 'vue';

import { posthog } from 'posthog-js';
import DefaultTheme from 'vitepress/theme';

import {
  languageFromPath,
  languageLocales,
  stripLanguagePrefix,
  translations,
} from '../i18n.ts';
import { initAnalytics } from './analytics.ts';
import LearnifyCourseCallout from './components/LearnifyCourseCallout.vue';
import { useFavorites } from './composables/useFavorites.ts';
import {
  captureFavoritesFocus,
  type FavoriteFocus,
  restoreFavoritesFocus,
} from './favorites-focus.ts';
import { needsFavoritesSidebarReconciliation } from './favorites-sidebar.ts';
import Layout from './RecordingsLayout.vue';
import { attachSearchAnalytics } from './search-analytics.ts';
import './custom.css';
import './style.css';

const favoriteSectionSelector = '#favorites-section';
const sidebarLinksSelector = '.VPSidebarItem a[href]';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export default {
  // eslint-disable-next-line max-lines-per-function -- Preserve the existing sidebar lifecycle during the migration.
  enhanceApp({ app, router }) {
    app.component('LearnifyCourseCallout', LearnifyCourseCallout);

    if (typeof window === 'undefined') return;
    {
      const {
        dispose,
        isFavorite: isSavedFavorite,
        subscribe,
        toggleFavorite: toggleSavedFavorite,
      } = useFavorites();
      const isFavorite = (link: string) =>
        isSavedFavorite(stripLanguagePrefix(link));
      const toggleFavorite = (link: string) => {
        toggleSavedFavorite(stripLanguagePrefix(link));
      };
      const currentLanguage = () => languageFromPath(router.route.path);
      const currentCopy = () => translations[currentLanguage()];

      if (POSTHOG_KEY) {
        const capture = initAnalytics(posthog, POSTHOG_KEY, POSTHOG_HOST);
        const disposeAnalytics = attachSearchAnalytics(capture);
        app.onUnmount(disposeAnalytics);
      }

      const createFavoriteStarIcon = () => {
        const svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg',
        );
        svg.setAttribute('class', 'favorite-star-icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');

        const path = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path',
        );
        path.setAttribute(
          'd',
          'M12 3.5 14.6 8.8l5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z',
        );
        svg.append(path);
        return svg;
      };

      const applyFavoriteState = (button: HTMLButtonElement, link: string) => {
        const active = isFavorite(link);
        if (!button.querySelector('.favorite-star-icon')) {
          button.append(createFavoriteStarIcon());
        }
        button.classList.toggle('active', active);
        button.setAttribute(
          'aria-label',
          active ? currentCopy().favorites.remove : currentCopy().favorites.add,
        );
        button.setAttribute(
          'title',
          active ? currentCopy().favorites.remove : currentCopy().favorites.add,
        );
        button.setAttribute('aria-pressed', String(active));
      };

      const handleFavoriteClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const link = (event.currentTarget as HTMLButtonElement).dataset[
          'favoriteLink'
        ];
        if (link) toggleFavorite(link);
      };

      const isEligibleFavoriteLink = (anchor: HTMLAnchorElement) => {
        const href = anchor.getAttribute('href');
        return Boolean(
          href &&
          href !== '#' &&
          href !== '/' &&
          !href.includes('/introduction') &&
          !href.includes('/index'),
        );
      };
      let isHydrated = false;
      let lastFocusedFavorite: FavoriteFocus | null = null;
      const rememberFavoriteFocus = (event: FocusEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const favoriteButton = target.closest<HTMLButtonElement>(
          'button.favorite-star',
        );
        const favoriteLink = target.closest<HTMLAnchorElement>(
          '#favorites-section a[href]',
        );
        if (favoriteButton?.dataset['favoriteLink']) {
          lastFocusedFavorite = {
            control: 'favorite',
            link: favoriteButton.dataset['favoriteLink'],
          };
        } else if (favoriteLink) {
          lastFocusedFavorite = {
            control: 'link',
            link: favoriteLink.getAttribute('href'),
          };
        }
      };
      const needsSidebarReconciliation = () => {
        const links = [
          ...document.querySelectorAll<HTMLAnchorElement>(sidebarLinksSelector),
        ].filter(
          (anchor) =>
            !anchor.closest(favoriteSectionSelector) &&
            isEligibleFavoriteLink(anchor),
        );
        if (links.length === 0) return false;

        const reconciliationLinks = links.map((anchor) => {
          const href = anchor.getAttribute('href');
          const item = anchor.closest('.item');
          const hasButton = Boolean(
            item &&
            [
              ...item.querySelectorAll<HTMLButtonElement>('.favorite-star'),
            ].some((button) => Object.is(button.dataset['favoriteLink'], href)),
          );
          return { hasButton, href };
        });
        const hasFavorites = links.some((anchor) =>
          isFavorite(anchor.getAttribute('href') ?? ''),
        );
        return needsFavoritesSidebarReconciliation(
          reconciliationLinks,
          hasFavorites,
          Boolean(document.querySelector(favoriteSectionSelector)),
        );
      };

      const createFavoritesSection = () => {
        const existingSection = document.querySelector(favoriteSectionSelector);
        const savedFocus =
          captureFavoritesFocus(existingSection, document.activeElement) ??
          (document.activeElement === document.body
            ? lastFocusedFavorite
            : null);
        if (existingSection) {
          existingSection.remove();
        }

        const favoriteLinks: Element[] = [];
        document
          .querySelectorAll<HTMLAnchorElement>(sidebarLinksSelector)
          .forEach((anchor) => {
            const href = anchor.getAttribute('href');
            if (
              !href ||
              href === '/' ||
              href.includes('/introduction') ||
              href.includes('/index') ||
              !isFavorite(href)
            )
              return;
            {
              const item = anchor.closest('.VPSidebarItem');
              if (item && !item.closest(favoriteSectionSelector)) {
                favoriteLinks.push(item);
              }
            }
          });

        if (favoriteLinks.length === 0) {
          restoreFavoritesFocus(document, savedFocus);
          return;
        }

        let sidebar = document.querySelector('.VPSidebar nav');
        sidebar ??= document.querySelector('.VPSidebar .nav');
        sidebar ??= document.querySelector('.VPSidebar .content');
        sidebar ??= document.querySelector('.VPSidebar > div:not(.curtain)');
        if (!sidebar) {
          const sidebarEl = document.querySelector('.VPSidebar');
          if (sidebarEl) {
            const children = Array.from(sidebarEl.children);
            sidebar =
              children.find(
                (child) =>
                  child.classList.contains('VPSidebarItem') ||
                  child.querySelector('.VPSidebarItem') !== null,
              ) ?? null;
            sidebar ??=
              children.find((child) => !child.classList.contains('curtain')) ??
              null;
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
        headerText.textContent = currentCopy().favorites.title;

        const headingIcon = document.createElement('span');
        headingIcon.className = 'favorites-heading-icon';
        headingIcon.setAttribute('aria-hidden', 'true');
        headingIcon.append(createFavoriteStarIcon());

        const favoriteCount = document.createElement('span');
        favoriteCount.className = 'favorites-count';
        favoriteCount.textContent = new Intl.NumberFormat(
          languageLocales[currentLanguage()],
        ).format(favoriteLinks.length);

        header.append(indicator);
        header.append(headingIcon);
        header.append(headerText);
        header.append(favoriteCount);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'items';

        for (const item of favoriteLinks) {
          const clone = item.cloneNode(true) as Element;

          const cloneStar =
            clone.querySelector<HTMLButtonElement>('.favorite-star');
          if (cloneStar)
            cloneStar.addEventListener('click', handleFavoriteClick);

          itemsContainer.append(clone);
        }

        favSection.append(header);
        favSection.append(itemsContainer);

        const firstChild = sidebar.firstElementChild;
        if (firstChild) {
          firstChild.before(favSection);
        } else {
          sidebar.append(favSection);
        }

        restoreFavoritesFocus(document, savedFocus);
      };

      const injectStarsAndFavorites = () => {
        document
          .querySelector('#VPSidebarNav')
          ?.setAttribute('aria-labelledby', 'localized-sidebar-label');
        const sidebarLinks =
          document.querySelectorAll<HTMLAnchorElement>(sidebarLinksSelector);
        if (sidebarLinks.length === 0) {
          return false;
        }

        sidebarLinks.forEach((anchor) => {
          const href = anchor.getAttribute('href');
          if (
            !href ||
            !isEligibleFavoriteLink(anchor) ||
            anchor.closest(favoriteSectionSelector)
          )
            return;
          const item = anchor.closest('.item');
          if (!item) return;

          let button = [
            ...item.querySelectorAll<HTMLButtonElement>('.favorite-star'),
          ].find((candidate) => candidate.dataset['favoriteLink'] === href);
          if (button) return;

          button = document.createElement('button');
          button.type = 'button';
          button.className = 'favorite-star';
          button.dataset['favoriteLink'] = href;
          button.addEventListener('click', handleFavoriteClick);
          applyFavoriteState(button, href);
          anchor.after(button);
        });

        createFavoritesSection();
        return true;
      };

      const updateAllStarsAndFavorites = () => {
        if (!isHydrated) return;
        document
          .querySelectorAll<HTMLButtonElement>('.favorite-star')
          .forEach((star) => {
            const link = star.dataset['favoriteLink'];
            if (link) applyFavoriteState(star, link);
          });

        createFavoritesSection();
      };

      const unsubscribeFavorites = subscribe(updateAllStarsAndFavorites);
      let reconciliationScheduled = false;
      let sidebarObserver: MutationObserver | undefined;
      const reconcileAfterSidebarUpdate = () => {
        reconciliationScheduled = false;
        if (isHydrated && needsSidebarReconciliation())
          injectStarsAndFavorites();
      };
      const initializeSidebarEnhancements = () => {
        if (isHydrated) return;
        isHydrated = true;

        document.addEventListener('focusin', rememberFavoriteFocus, {
          capture: true,
        });
        sidebarObserver = new MutationObserver(() => {
          if (reconciliationScheduled) return;
          reconciliationScheduled = true;
          requestAnimationFrame(reconcileAfterSidebarUpdate);
        });
        const appRoot = document.querySelector('#app');
        if (appRoot)
          sidebarObserver.observe(appRoot, { childList: true, subtree: true });

        injectStarsAndFavorites();
      };

      // Vue.js calls mounted on the root only after initial SSR hydration has finished.
      app.mixin({
        mounted(this: ComponentPublicInstance) {
          if (this === this.$root) initializeSidebarEnhancements();
        },
      });

      app.onUnmount(() => {
        unsubscribeFavorites();
        sidebarObserver?.disconnect();
        if (isHydrated)
          document.removeEventListener('focusin', rememberFavoriteFocus, true);
        dispose();
      });

      const initWithRetry = () => {
        updateAllStarsAndFavorites();
        injectStarsAndFavorites();
      };

      router.onAfterRouteChange = () => {
        if (isHydrated) setTimeout(initWithRetry, 50);
      };
    }
  },
  extends: DefaultTheme,
  Layout,
} satisfies Theme;
