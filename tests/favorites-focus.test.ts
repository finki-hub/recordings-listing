import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureFavoritesFocus,
  restoreFavoritesFocus,
} from '../.vitepress/theme/favorites-focus.ts';
import { domFixture } from './helpers.ts';

const mathLink = '/courses/math';

const favoriteButton = (link: string) => {
  const button = domFixture<HTMLButtonElement & { focused: boolean }>({
    closest: (selector: string) =>
      selector === 'button.favorite-star' ? button : null,
    dataset: { favoriteLink: link },
    focus: () => {
      button.focused = true;
    },
    focused: false,
  });
  return button;
};

const section = ({
  activeElement = null,
  buttons = [],
  links = [],
}: {
  activeElement?: Element | null;
  buttons?: HTMLButtonElement[];
  links?: HTMLAnchorElement[];
} = {}) =>
  domFixture<Element>({
    contains: (element: Element) => element === activeElement,
    querySelector: (selector: string) =>
      selector === 'a[href], button.favorite-star'
        ? (links[0] ?? buttons[0] ?? null)
        : null,
    querySelectorAll: (selector: string) => {
      if (selector === 'button.favorite-star') return buttons;
      return selector === 'a[href]' ? links : [];
    },
  });

const sidebarLink = (href: string) => {
  const link = domFixture<HTMLAnchorElement & { focused: boolean }>({
    closest: (selector: string) => (selector === 'a[href]' ? link : null),
    focus: () => {
      link.focused = true;
    },
    focused: false,
    getAttribute: (name: string) => (name === 'href' ? href : null),
  });
  return link;
};

test('preserves focus on the equivalent favorite button after the section rerenders', () => {
  const oldButton = favoriteButton(mathLink);
  const oldSection = section({
    activeElement: oldButton,
    buttons: [oldButton],
  });
  const saved = captureFavoritesFocus(oldSection, oldButton);
  const unrelatedButton = favoriteButton('/courses/physics');
  const replacementButton = favoriteButton(mathLink);
  const replacementSection = section({
    buttons: [unrelatedButton, replacementButton],
  });
  const document = {
    querySelector: (selector: string) =>
      selector === '#favorites-section' ? replacementSection : null,
    querySelectorAll: () => [],
  };

  restoreFavoritesFocus(domFixture<Document>(document), saved);
  assert.equal(replacementButton.focused, true);
  assert.equal(
    unrelatedButton.focused,
    false,
    'an earlier nonmatching favorite is not focused',
  );
});

test('moves focus to the original course favorite button when a removed favorite disappears', () => {
  const oldButton = favoriteButton(mathLink);
  const oldSection = section({
    activeElement: oldButton,
    buttons: [oldButton],
  });
  const saved = captureFavoritesFocus(oldSection, oldButton);
  const unrelatedButton = favoriteButton('/courses/physics');
  unrelatedButton.closest = () => null;
  const originalButton = favoriteButton(mathLink);
  originalButton.closest = () => null;
  const document = {
    querySelector: () => null,
    querySelectorAll: (selector: string) =>
      selector === '.VPSidebarItem button.favorite-star'
        ? [unrelatedButton, originalButton]
        : [],
  };

  restoreFavoritesFocus(domFixture<Document>(document), saved);
  assert.equal(originalButton.focused, true);
  assert.equal(
    unrelatedButton.focused,
    false,
    'the fallback matches the saved link, not the first button',
  );
});

test('does not move focus when an unrelated control is active', () => {
  const unrelated = domFixture<Element>({});
  const document = {
    querySelector: () => {
      throw new Error('must not query focus fallback');
    },
    querySelectorAll: () => {
      throw new Error('must not query focus fallback');
    },
  };

  const saved = captureFavoritesFocus(section(), unrelated);
  assert.equal(saved, null);
  assert.doesNotThrow(() => {
    restoreFavoritesFocus(domFixture<Document>(document), saved);
  });
});

test('preserves focus on a favorite link that remains in the rebuilt section', () => {
  const oldLink = sidebarLink(mathLink);
  const oldSection = section({ activeElement: oldLink, links: [oldLink] });
  const saved = captureFavoritesFocus(oldSection, oldLink);
  const unrelatedLink = sidebarLink('/courses/physics');
  const replacementLink = sidebarLink(mathLink);
  const replacementSection = section({
    links: [unrelatedLink, replacementLink],
  });
  const document = {
    querySelector: (selector: string) =>
      selector === '#favorites-section' ? replacementSection : null,
    querySelectorAll: () => [],
  };

  restoreFavoritesFocus(domFixture<Document>(document), saved);
  assert.equal(replacementLink.focused, true);
  assert.equal(
    unrelatedLink.focused,
    false,
    'an earlier nonmatching favorite link is not focused',
  );
});
