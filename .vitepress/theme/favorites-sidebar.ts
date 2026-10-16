export const needsFavoritesSidebarReconciliation = (
  links: Array<{ hasButton: boolean; href: null | string }>,
  hasFavorites: boolean,
  sectionExists: boolean,
) =>
  links.length > 0 &&
  (links.some(({ hasButton }) => !hasButton) || hasFavorites !== sectionExists);
