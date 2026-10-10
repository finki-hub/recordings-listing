export function needsFavoritesSidebarReconciliation(links, hasFavorites, sectionExists) {
  if (links.length === 0) return false;
  return links.some(({ hasButton }) => !hasButton) || hasFavorites !== sectionExists;
}
