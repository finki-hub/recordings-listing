export type FavoriteFocus = {
  control: 'favorite' | 'link';
  link: null | string;
};

export const captureFavoritesFocus = (
  section: Element | null,
  activeElement: Element | null,
): FavoriteFocus | null => {
  if (!section || !activeElement || !section.contains(activeElement))
    return null;

  const favoriteButton = activeElement.closest<HTMLButtonElement>(
    'button.favorite-star',
  );
  if (favoriteButton?.dataset['favoriteLink']) {
    return {
      control: 'favorite',
      link: favoriteButton.dataset['favoriteLink'],
    };
  }

  const link = activeElement.closest('a[href]');
  return link ? { control: 'link', link: link.getAttribute('href') } : null;
};

export const restoreFavoritesFocus = (
  document: Document,
  savedFocus: FavoriteFocus | null,
) => {
  if (!savedFocus) return;

  const section = document.querySelector('#favorites-section');
  let target: HTMLElement | null | undefined;

  if (section && savedFocus.control === 'favorite') {
    target = [
      ...section.querySelectorAll<HTMLButtonElement>('button.favorite-star'),
    ].find((button) =>
      Object.is(button.dataset['favoriteLink'], savedFocus.link),
    );
  } else if (section && savedFocus.control === 'link') {
    target = [...section.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
      (link) => link.getAttribute('href') === savedFocus.link,
    );
  }

  if (!target && savedFocus.link) {
    target = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.VPSidebarItem button.favorite-star',
      ),
    ].find(
      (button) =>
        !button.closest('#favorites-section') &&
        Object.is(button.dataset['favoriteLink'], savedFocus.link),
    );
  }

  if (!target && section)
    target = section.querySelector<HTMLElement>(
      'a[href], button.favorite-star',
    );
  target?.focus();
};
