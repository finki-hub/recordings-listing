import assert from 'node:assert/strict';
import test from 'node:test';
import { captureFavoritesFocus, restoreFavoritesFocus } from '../.vitepress/theme/favorites-focus.js';

function favoriteButton(link) {
  return {
    dataset: { favoriteLink: link },
    focused: false,
    closest(selector) {
      return selector === 'button.favorite-star' ? this : null;
    },
    focus() { this.focused = true; },
  };
}

function sidebarLink(href) {
  return {
    focused: false,
    getAttribute(name) { return name === 'href' ? href : null; },
    closest(selector) { return selector === 'a[href]' ? this : null; },
    focus() { this.focused = true; },
  };
}

function section({ buttons = [], links = [], activeElement = null } = {}) {
  return {
    contains(element) { return element === activeElement; },
    querySelectorAll(selector) {
      return selector === 'button.favorite-star' ? buttons : links;
    },
    querySelector(selector) {
      if (selector === 'a[href], button.favorite-star') return links[0] ?? buttons[0] ?? null;
      return null;
    },
  };
}

test('preserves focus on the equivalent favorite button after the section rerenders', () => {
  const oldButton = favoriteButton('/courses/math');
  const oldSection = section({ buttons: [oldButton], activeElement: oldButton });
  const saved = captureFavoritesFocus(oldSection, oldButton);
  const replacementButton = favoriteButton('/courses/math');
  const replacementSection = section({ buttons: [replacementButton] });
  const document = {
    querySelector(selector) { return selector === '#favorites-section' ? replacementSection : null; },
    querySelectorAll() { return []; },
  };

  restoreFavoritesFocus(document, saved);
  assert.equal(replacementButton.focused, true);
});

test('moves focus to the original course favorite button when a removed favorite disappears', () => {
  const oldButton = favoriteButton('/courses/math');
  const oldSection = section({ buttons: [oldButton], activeElement: oldButton });
  const saved = captureFavoritesFocus(oldSection, oldButton);
  const originalButton = favoriteButton('/courses/math');
  originalButton.closest = () => null;
  const document = {
    querySelector() { return null; },
    querySelectorAll(selector) {
      return selector === '.VPSidebarItem button.favorite-star' ? [originalButton] : [];
    },
  };

  restoreFavoritesFocus(document, saved);
  assert.equal(originalButton.focused, true);
});

test('does not move focus when an unrelated control is active', () => {
  const unrelated = {};
  const document = {
    querySelector() { throw new Error('must not query focus fallback'); },
    querySelectorAll() { throw new Error('must not query focus fallback'); },
  };

  const saved = captureFavoritesFocus(section(), unrelated);
  assert.equal(saved, null);
  assert.doesNotThrow(() => restoreFavoritesFocus(document, saved));
});

test('preserves focus on a favorite link that remains in the rebuilt section', () => {
  const oldLink = sidebarLink('/courses/math');
  const oldSection = section({ links: [oldLink], activeElement: oldLink });
  const saved = captureFavoritesFocus(oldSection, oldLink);
  const replacementLink = sidebarLink('/courses/math');
  const replacementSection = section({ links: [replacementLink] });
  const document = {
    querySelector(selector) { return selector === '#favorites-section' ? replacementSection : null; },
    querySelectorAll() { return []; },
  };

  restoreFavoritesFocus(document, saved);
  assert.equal(replacementLink.focused, true);
});
