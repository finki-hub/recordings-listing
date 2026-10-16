import assert from 'node:assert/strict';
import test from 'node:test';

import { createFavoritesState } from '../.vitepress/theme/favorites-state.ts';
import { at } from './helpers.ts';

type StorageChange = Pick<StorageEvent, 'key' | 'newValue'> & {
  oldValue?: null | string;
  storageArea?: Pick<Storage, 'getItem' | 'setItem'>;
};

const mathLink = '/courses/math';
const programmingLink = '/courses/programming';

const createSharedStorage = (initialValue: null | string = null) => {
  let value = initialValue;
  const clients: Array<{
    emit: (event: StorageChange) => void;
    storage: Pick<Storage, 'getItem' | 'setItem'>;
  }> = [];

  const createClient = ({ deliverEvents = true } = {}) => {
    const listeners = new Set<(event: StorageChange) => void>();
    const client = {
      emit: (event: StorageChange) => {
        if (deliverEvents)
          listeners.forEach((listener) => {
            listener(event);
          });
      },
      eventTarget: {
        addEventListener: (
          type: string,
          listener: (event: StorageChange) => void,
        ) => {
          if (type === 'storage') listeners.add(listener);
        },
        removeEventListener: (
          type: string,
          listener: (event: StorageChange) => void,
        ) => {
          if (type === 'storage') listeners.delete(listener);
        },
      },
      get listenerCount() {
        return listeners.size;
      },
      storage: {
        getItem: (key: string) => (key === 'favorites' ? value : null),
        setItem: (key: string, nextValue: string) => {
          if (key !== 'favorites') return;
          const oldValue = value;
          value = nextValue;
          for (const other of clients) {
            if (other !== client) {
              other.emit({
                key,
                newValue: value,
                oldValue,
                storageArea: other.storage,
              });
            }
          }
        },
      },
    };
    clients.push(client);
    return client;
  };

  return {
    createClient,
    setValue: (nextValue: null | string) => {
      value = nextValue;
    },
    get value() {
      return value;
    },
  };
};

test('retains existing persisted favorites and toggles a link in the current tab', () => {
  const shared = createSharedStorage(JSON.stringify([mathLink, mathLink, 7]));
  const client = shared.createClient();
  const state = createFavoritesState(client);

  assert.deepEqual([...state.favorites], [mathLink]);
  state.toggleFavorite(programmingLink);
  assert.equal(state.isFavorite(mathLink), true);
  assert.equal(state.isFavorite(programmingLink), true);
  assert.deepEqual(JSON.parse(shared.value ?? 'null') as unknown, [
    mathLink,
    programmingLink,
  ]);

  state.toggleFavorite(mathLink);
  assert.equal(state.isFavorite(mathLink), false);
  assert.equal(state.isFavorite(programmingLink), true);
});

test('synchronizes sequential additions and removals between tabs', () => {
  const shared = createSharedStorage();
  const firstTab = createFavoritesState(shared.createClient());
  const secondTab = createFavoritesState(shared.createClient());
  const firstChanges: string[][] = [];
  const secondChanges: string[][] = [];
  firstTab.subscribe((favorites) => {
    firstChanges.push([...favorites]);
  });
  secondTab.subscribe((favorites) => {
    secondChanges.push([...favorites]);
  });

  firstTab.toggleFavorite(mathLink);
  assert.equal(secondTab.isFavorite(mathLink), true);

  secondTab.toggleFavorite(programmingLink);
  assert.equal(firstTab.isFavorite(mathLink), true);
  assert.equal(firstTab.isFavorite(programmingLink), true);

  firstTab.toggleFavorite(mathLink);
  assert.equal(secondTab.isFavorite(mathLink), false);
  assert.equal(secondTab.isFavorite(programmingLink), true);

  secondTab.toggleFavorite(programmingLink);
  assert.deepEqual([...firstTab.favorites], []);
  assert.deepEqual([...secondTab.favorites], []);
  assert.ok(firstChanges.length >= 3);
  assert.ok(secondChanges.length >= 3);
});

test('re-reads shared storage before a second tab toggles while its storage event is pending', () => {
  const shared = createSharedStorage();
  const firstTab = createFavoritesState(shared.createClient());
  const secondTab = createFavoritesState(
    shared.createClient({ deliverEvents: false }),
  );

  firstTab.toggleFavorite(mathLink);
  assert.equal(secondTab.isFavorite(mathLink), false);

  secondTab.toggleFavorite(programmingLink);
  assert.deepEqual(JSON.parse(shared.value ?? 'null') as unknown, [
    mathLink,
    programmingLink,
  ]);
});

test('storage access failures do not throw or discard current-tab state', () => {
  let unavailable = false;
  const storage = {
    getItem: () => {
      if (unavailable) throw new Error('storage unavailable');
      return null;
    },
    setItem: () => {
      if (unavailable) throw new Error('storage unavailable');
    },
  };
  const state = createFavoritesState({ storage });

  state.toggleFavorite(mathLink);
  unavailable = true;
  assert.doesNotThrow(() => {
    state.toggleFavorite(programmingLink);
  });
  assert.equal(state.isFavorite(mathLink), true);
  assert.equal(state.isFavorite(programmingLink), true);
});

test('switches to in-memory state after a readable storage write fails', () => {
  const initial = JSON.stringify(['/courses/already-favorite']);
  const listeners = new Set<(event: StorageChange) => void>();
  const storage = {
    getItem: () => initial,
    setItem: () => {
      throw new Error('quota exceeded');
    },
  };
  const eventTarget = {
    addEventListener: (
      type: string,
      listener: (event: StorageChange) => void,
    ) => {
      if (type === 'storage') listeners.add(listener);
    },
    removeEventListener: (
      type: string,
      listener: (event: StorageChange) => void,
    ) => {
      if (type === 'storage') listeners.delete(listener);
    },
  };
  const state = createFavoritesState({ eventTarget, storage });

  assert.doesNotThrow(() => {
    state.toggleFavorite('/courses/first-addition');
  });
  assert.doesNotThrow(() => {
    state.toggleFavorite('/courses/second-addition');
  });
  state.toggleFavorite('/courses/already-favorite');
  assert.deepEqual(
    [...state.favorites],
    ['/courses/first-addition', '/courses/second-addition'],
  );

  listeners.forEach((listener) => {
    listener({
      key: 'favorites',
      newValue: initial,
    });
  });
  assert.deepEqual(
    [...state.favorites],
    ['/courses/first-addition', '/courses/second-addition'],
  );
});

test('ignores unrelated storage events and removes its listener on dispose', () => {
  const client = createSharedStorage().createClient();
  const state = createFavoritesState(client);
  let notifications = 0;
  state.subscribe(() => (notifications += 1));
  assert.equal(client.listenerCount, 1);

  client.emit({ key: 'unrelated', newValue: '[]' });
  assert.equal(notifications, 0);
  state.dispose();
  assert.equal(
    client.listenerCount,
    0,
    'dispose removes the storage listener itself',
  );
  client.emit({ key: 'favorites', newValue: '[]' });
  assert.equal(notifications, 0);
});

test('malformed and non-array storage events preserve state while a clear event empties it', () => {
  const shared = createSharedStorage(JSON.stringify([mathLink]));
  const client = shared.createClient();
  const state = createFavoritesState(client);
  const snapshots: string[][] = [];
  state.subscribe((favorites) => {
    snapshots.push([...favorites]);
  });

  shared.setValue('{malformed');
  client.emit({ key: 'favorites', newValue: '{malformed' });
  assert.deepEqual([...state.favorites], [mathLink]);

  shared.setValue(JSON.stringify({ not: 'an array' }));
  client.emit({
    key: 'favorites',
    newValue: JSON.stringify({ not: 'an array' }),
  });
  assert.deepEqual([...state.favorites], [mathLink]);

  shared.setValue(null);
  client.emit({ key: null, newValue: null });
  assert.deepEqual([...state.favorites], []);
  assert.deepEqual(snapshots, [[mathLink], [mathLink], []]);
});

test('favorites and subscriber snapshots are isolated, and unsubscribe stops notifications', () => {
  const state = createFavoritesState({ storage: null });
  state.toggleFavorite(mathLink);

  const exposed = state.favorites;
  exposed.clear();
  assert.equal(
    state.isFavorite(mathLink),
    true,
    'mutating the getter result does not mutate state',
  );

  const received: Array<Set<string>> = [];
  const unsubscribe = state.subscribe((snapshot) => {
    received.push(snapshot);
  });
  state.toggleFavorite(programmingLink);
  assert.deepEqual([...at(received, 0)], [mathLink, programmingLink]);

  unsubscribe();
  state.toggleFavorite(mathLink);
  assert.equal(received.length, 1, 'unsubscribe prevents later notifications');
  assert.deepEqual([...state.favorites], [programmingLink]);
  assert.deepEqual(
    [...at(received, 0)],
    [mathLink, programmingLink],
    'a past notification is not a live view',
  );
  at(received, 0).clear();
  assert.equal(
    state.isFavorite(programmingLink),
    true,
    'mutating a published snapshot does not mutate state',
  );
});
