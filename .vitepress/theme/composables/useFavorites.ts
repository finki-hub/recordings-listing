import { computed, ref } from 'vue';

import { createFavoritesState } from '../favorites-state.ts';

const getStorage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const state = createFavoritesState({
  eventTarget: typeof window === 'undefined' ? undefined : globalThis,
  storage: getStorage(),
});
const favorites = ref(state.favorites);
const unsubscribeState = state.subscribe((next: Set<string>) => {
  favorites.value = next;
});

const isFavorite = (link: string) => state.isFavorite(link);
const toggleFavorite = (link: string) => {
  state.toggleFavorite(link);
};
const sortFavorites = <Item extends { link: string }>(items: Item[]) =>
  items.toSorted((a, b) => {
    const aFav = isFavorite(a.link);
    const bFav = isFavorite(b.link);
    if (aFav && !bFav) return -1;
    return !aFav && bFav ? 1 : 0;
  });
const sortedItems = computed(() => sortFavorites);

export const useFavorites = () => ({
  dispose: () => {
    unsubscribeState();
    state.dispose();
  },
  favorites,
  isFavorite,
  sortedItems,
  subscribe: (subscriber: (snapshot: Set<string>) => void) =>
    state.subscribe(subscriber),
  toggleFavorite,
});
