const STORAGE_KEY = 'favorites';

function readFavorites(storage, fallback = new Set()) {
  if (!storage) return new Set(fallback);

  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (serialized === null) return new Set();

    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item) => typeof item === 'string'))
      : new Set(fallback);
  } catch {
    return new Set(fallback);
  }
}

export function createFavoritesState({ storage, eventTarget } = {}) {
  let favorites = readFavorites(storage);
  let persistenceAvailable = Boolean(storage?.getItem && storage?.setItem);
  const subscribers = new Set();

  const publish = () => {
    const snapshot = new Set(favorites);
    subscribers.forEach((subscriber) => subscriber(snapshot));
  };

  const handleStorage = (event) => {
    if (!persistenceAvailable || (event.key !== STORAGE_KEY && event.key !== null)) return;
    // Read the latest stored value rather than trusting a possibly stale event.
    favorites = readFavorites(storage, favorites);
    publish();
  };

  eventTarget?.addEventListener('storage', handleStorage);

  return {
    get favorites() {
      return new Set(favorites);
    },
    isFavorite(link) {
      return favorites.has(link);
    },
    toggleFavorite(link) {
      if (typeof link !== 'string' || !link) return;

      // Reconcile before changing state so another tab's recent edits survive.
      const next = persistenceAvailable ? readFavorites(storage, favorites) : new Set(favorites);
      if (next.has(link)) next.delete(link);
      else next.add(link);

      favorites = next;
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
      } catch {
        // Stop reconciling against stale persisted values after writes fail.
        persistenceAvailable = false;
      }
      publish();
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    dispose() {
      eventTarget?.removeEventListener('storage', handleStorage);
      subscribers.clear();
    },
  };
}
