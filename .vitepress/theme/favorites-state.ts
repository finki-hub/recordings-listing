const STORAGE_KEY = 'favorites';

type FavoritesOptions = {
  eventTarget?: {
    addEventListener: (type: 'storage', listener: StorageListener) => void;
    removeEventListener: (type: 'storage', listener: StorageListener) => void;
  };
  storage?: FavoriteStorage | null;
};
type FavoriteStorage = Pick<Storage, 'getItem' | 'setItem'>;
type StorageListener = (event: Pick<StorageEvent, 'key'>) => void;

const readFavorites = (
  storage: FavoriteStorage | null | undefined,
  fallback = new Set<string>(),
): Set<string> => {
  if (!storage) return new Set(fallback);

  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (serialized === null) return new Set();

    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item) => typeof item === 'string'))
      : new Set(fallback);
  } catch {
    return new Set(fallback);
  }
};

export const createFavoritesState = ({
  eventTarget,
  storage,
}: FavoritesOptions = {}) => {
  let favorites = readFavorites(storage);
  let persistenceAvailable = storage !== undefined && storage !== null;
  const subscribers = new Set<(favorites: Set<string>) => void>();

  const publish = () => {
    const snapshot = new Set(favorites);
    subscribers.forEach((subscriber) => {
      subscriber(snapshot);
    });
  };

  const handleStorage: StorageListener = (event) => {
    if (
      !persistenceAvailable ||
      (event.key !== STORAGE_KEY && event.key !== null)
    )
      return;
    // Read the latest stored value rather than trusting a possibly stale event.
    favorites = readFavorites(storage, favorites);
    publish();
  };

  eventTarget?.addEventListener('storage', handleStorage);

  return {
    dispose() {
      eventTarget?.removeEventListener('storage', handleStorage);
      subscribers.clear();
    },
    get favorites() {
      return new Set(favorites);
    },
    isFavorite(link: string) {
      return favorites.has(link);
    },
    subscribe(subscriber: (favorites: Set<string>) => void) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    toggleFavorite(link: unknown) {
      if (typeof link !== 'string' || !link) return;

      // Reconcile before changing state so another tab's recent edits survive.
      const next = persistenceAvailable
        ? readFavorites(storage, favorites)
        : new Set(favorites);
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
  };
};
