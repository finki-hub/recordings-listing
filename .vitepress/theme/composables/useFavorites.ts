import { ref, computed } from 'vue'

const STORAGE_KEY = 'favorites'

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favorites: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
  } catch {
  }
}

const favorites = ref<Set<string>>(new Set())

if (typeof window !== 'undefined' && favorites.value.size === 0) {
  favorites.value = loadFavorites()
}

export function useFavorites() {
  const isFavorite = (link: string) => favorites.value.has(link)

  const toggleFavorite = (link: string) => {
    if (favorites.value.has(link)) {
      favorites.value.delete(link)
    } else {
      favorites.value.add(link)
    }
    favorites.value = new Set(favorites.value)
    saveFavorites(favorites.value)
  }

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
    sortedItems
  }
}
