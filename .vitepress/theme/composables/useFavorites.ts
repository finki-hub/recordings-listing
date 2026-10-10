import { ref, computed } from 'vue'
import { createFavoritesState } from '../favorites-state.js'

function getStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

const state = createFavoritesState({
  storage: getStorage(),
  eventTarget: typeof window === 'undefined' ? undefined : window,
})
const favorites = ref(state.favorites)
const unsubscribeState = state.subscribe((next) => { favorites.value = next })

export function useFavorites() {
  const isFavorite = (link: string) => state.isFavorite(link)
  const toggleFavorite = (link: string) => state.toggleFavorite(link)
  const sortedItems = computed(() => (items: any[]) => {
    return [...items].sort((a, b) => {
      const aFav = isFavorite(a.link)
      const bFav = isFavorite(b.link)
      if (aFav && !bFav) return -1
      if (!aFav && bFav) return 1
      return 0
    })
  })

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    subscribe: state.subscribe,
    dispose() {
      unsubscribeState()
      state.dispose()
    },
    sortedItems
  }
}
