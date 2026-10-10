import assert from 'node:assert/strict';
import test from 'node:test';
import { createFavoritesState } from '../.vitepress/theme/favorites-state.js';

function createSharedStorage(initialValue = null) {
  let value = initialValue;
  const clients = [];

  function createClient({ deliverEvents = true } = {}) {
    const listeners = new Set();
    const client = {
      emit(event) {
        if (deliverEvents) listeners.forEach((listener) => listener(event));
      },
      storage: {
        getItem(key) {
          return key === 'favorites' ? value : null;
        },
        setItem(key, nextValue) {
          if (key !== 'favorites') return;
          const oldValue = value;
          value = String(nextValue);
          clients.forEach((other) => {
            if (other !== client) {
              other.emit({ key, oldValue, newValue: value, storageArea: other.storage });
            }
          });
        },
      },
      eventTarget: {
        addEventListener(type, listener) {
          if (type === 'storage') listeners.add(listener);
        },
        removeEventListener(type, listener) {
          if (type === 'storage') listeners.delete(listener);
        },
      },
      get listenerCount() { return listeners.size; },
    };
    clients.push(client);
    return client;
  }

  return { createClient, get value() { return value; }, setValue(nextValue) { value = nextValue; } };
}

test('retains existing persisted favorites and toggles a link in the current tab', () => {
  const shared = createSharedStorage(JSON.stringify(['/courses/math', '/courses/math', 7]));
  const client = shared.createClient();
  const state = createFavoritesState(client);

  assert.deepEqual([...state.favorites], ['/courses/math']);
  state.toggleFavorite('/courses/programming');
  assert.equal(state.isFavorite('/courses/math'), true);
  assert.equal(state.isFavorite('/courses/programming'), true);
  assert.deepEqual(JSON.parse(shared.value), ['/courses/math', '/courses/programming']);

  state.toggleFavorite('/courses/math');
  assert.equal(state.isFavorite('/courses/math'), false);
  assert.equal(state.isFavorite('/courses/programming'), true);
});

test('synchronizes sequential additions and removals between tabs', () => {
  const shared = createSharedStorage();
  const firstTab = createFavoritesState(shared.createClient());
  const secondTab = createFavoritesState(shared.createClient());
  const firstChanges = [];
  const secondChanges = [];
  firstTab.subscribe((favorites) => firstChanges.push([...favorites]));
  secondTab.subscribe((favorites) => secondChanges.push([...favorites]));

  firstTab.toggleFavorite('/courses/math');
  assert.equal(secondTab.isFavorite('/courses/math'), true);

  secondTab.toggleFavorite('/courses/programming');
  assert.equal(firstTab.isFavorite('/courses/math'), true);
  assert.equal(firstTab.isFavorite('/courses/programming'), true);

  firstTab.toggleFavorite('/courses/math');
  assert.equal(secondTab.isFavorite('/courses/math'), false);
  assert.equal(secondTab.isFavorite('/courses/programming'), true);

  secondTab.toggleFavorite('/courses/programming');
  assert.deepEqual([...firstTab.favorites], []);
  assert.deepEqual([...secondTab.favorites], []);
  assert.ok(firstChanges.length >= 3);
  assert.ok(secondChanges.length >= 3);
});

test('re-reads shared storage before a second tab toggles while its storage event is pending', () => {
  const shared = createSharedStorage();
  const firstTab = createFavoritesState(shared.createClient());
  const secondTab = createFavoritesState(shared.createClient({ deliverEvents: false }));

  firstTab.toggleFavorite('/courses/math');
  assert.equal(secondTab.isFavorite('/courses/math'), false);

  secondTab.toggleFavorite('/courses/programming');
  assert.deepEqual(JSON.parse(shared.value), ['/courses/math', '/courses/programming']);
});

test('storage access failures do not throw or discard current-tab state', () => {
  let unavailable = false;
  const storage = {
    getItem() {
      if (unavailable) throw new Error('storage unavailable');
      return null;
    },
    setItem() {
      if (unavailable) throw new Error('storage unavailable');
    },
  };
  const state = createFavoritesState({ storage });

  state.toggleFavorite('/courses/math');
  unavailable = true;
  assert.doesNotThrow(() => state.toggleFavorite('/courses/programming'));
  assert.equal(state.isFavorite('/courses/math'), true);
  assert.equal(state.isFavorite('/courses/programming'), true);
});

test('switches to in-memory state after a readable storage write fails', () => {
  const initial = JSON.stringify(['/courses/already-favorite']);
  const listeners = new Set();
  const storage = {
    getItem() { return initial; },
    setItem() { throw new Error('quota exceeded'); },
  };
  const eventTarget = {
    addEventListener(type, listener) {
      if (type === 'storage') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'storage') listeners.delete(listener);
    },
  };
  const state = createFavoritesState({ storage, eventTarget });

  assert.doesNotThrow(() => state.toggleFavorite('/courses/first-addition'));
  assert.doesNotThrow(() => state.toggleFavorite('/courses/second-addition'));
  state.toggleFavorite('/courses/already-favorite');
  assert.deepEqual([...state.favorites], ['/courses/first-addition', '/courses/second-addition']);

  listeners.forEach((listener) => listener({
    key: 'favorites',
    newValue: initial,
  }));
  assert.deepEqual([...state.favorites], ['/courses/first-addition', '/courses/second-addition']);
});

test('ignores unrelated storage events and removes its listener on dispose', () => {
  const client = createSharedStorage().createClient();
  const state = createFavoritesState(client);
  let notifications = 0;
  state.subscribe(() => notifications++);
  assert.equal(client.listenerCount, 1);

  client.emit({ key: 'unrelated', newValue: '[]' });
  assert.equal(notifications, 0);
  state.dispose();
  assert.equal(client.listenerCount, 0, 'dispose removes the storage listener itself');
  client.emit({ key: 'favorites', newValue: '[]' });
  assert.equal(notifications, 0);
});

test('malformed and non-array storage events preserve state while a clear event empties it', () => {
  const shared = createSharedStorage(JSON.stringify(['/courses/math']));
  const client = shared.createClient();
  const state = createFavoritesState(client);
  const snapshots = [];
  state.subscribe((favorites) => snapshots.push([...favorites]));

  shared.setValue('{malformed');
  client.emit({ key: 'favorites', newValue: '{malformed' });
  assert.deepEqual([...state.favorites], ['/courses/math']);

  shared.setValue(JSON.stringify({ not: 'an array' }));
  client.emit({ key: 'favorites', newValue: JSON.stringify({ not: 'an array' }) });
  assert.deepEqual([...state.favorites], ['/courses/math']);

  shared.setValue(null);
  client.emit({ key: null, newValue: null });
  assert.deepEqual([...state.favorites], []);
  assert.deepEqual(snapshots, [['/courses/math'], ['/courses/math'], []]);
});

test('favorites and subscriber snapshots are isolated, and unsubscribe stops notifications', () => {
  const state = createFavoritesState({ storage: null });
  state.toggleFavorite('/courses/math');

  const exposed = state.favorites;
  exposed.clear();
  assert.equal(state.isFavorite('/courses/math'), true, 'mutating the getter result does not mutate state');

  const received = [];
  const unsubscribe = state.subscribe((snapshot) => received.push(snapshot));
  state.toggleFavorite('/courses/programming');
  assert.deepEqual([...received[0]], ['/courses/math', '/courses/programming']);

  unsubscribe();
  state.toggleFavorite('/courses/math');
  assert.equal(received.length, 1, 'unsubscribe prevents later notifications');
  assert.deepEqual([...state.favorites], ['/courses/programming']);
  assert.deepEqual([...received[0]], ['/courses/math', '/courses/programming'], 'a past notification is not a live view');
  received[0].clear();
  assert.equal(state.isFavorite('/courses/programming'), true, 'mutating a published snapshot does not mutate state');
});
