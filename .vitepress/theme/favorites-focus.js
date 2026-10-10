export function captureFavoritesFocus(section, activeElement) {
  if (!section || !activeElement || !section.contains(activeElement)) return null;

  const favoriteButton = activeElement.closest?.('button.favorite-star');
  if (favoriteButton?.dataset.favoriteLink) {
    return { link: favoriteButton.dataset.favoriteLink, control: 'favorite' };
  }

  const link = activeElement.closest?.('a[href]');
  if (link) return { link: link.getAttribute('href'), control: 'link' };
  return null;
}

export function restoreFavoritesFocus(document, savedFocus) {
  if (!savedFocus) return;

  const section = document.querySelector('#favorites-section');
  let target;

  if (section && savedFocus.control === 'favorite') {
    target = [...section.querySelectorAll('button.favorite-star')]
      .find((button) => button.dataset.favoriteLink === savedFocus.link);
  } else if (section && savedFocus.control === 'link') {
    target = [...section.querySelectorAll('a[href]')]
      .find((link) => link.getAttribute('href') === savedFocus.link);
  }

  if (!target && savedFocus.link) {
    target = [...document.querySelectorAll('.VPSidebarItem button.favorite-star')]
      .find((button) => !button.closest('#favorites-section') &&
        button.dataset.favoriteLink === savedFocus.link);
  }

  if (!target && section) target = section.querySelector('a[href], button.favorite-star');
  target?.focus();
}
