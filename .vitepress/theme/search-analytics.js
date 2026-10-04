// Query identity is local, exact and ephemeral. Only a random attempt ID leaves
// this module. The 500ms timer affects measurement, never VitePress search.
export function createSearchTracker({ capture, randomUUID = () => crypto.randomUUID(), schedule = setTimeout, cancel = clearTimeout }) {
  let query = '';
  let count = 0;
  let ready = false;
  let settled;
  let timer;
  let disposed = false;
  const send = (event, properties) => {
    try { capture(event, properties); } catch { /* Fail open for the search UI. */ }
  };
  const reportResults = (event) => {
    const properties = { search_id: settled.id, result_count: count };
    send(event, properties);
    if (count === 0) send('search_zero_results_v2', properties);
  };
  const settle = () => {
    timer = undefined;
    if (disposed || !query.trim() || !ready) return;
    if (settled?.query === query) {
      if (settled.count !== count) {
        settled.count = count;
        reportResults('search_results_updated_v2');
      }
      return;
    }
    settled = { query, count, id: randomUUID() };
    reportResults('catalog_search_v2');
  };
  return {
    update(value, resultCount, resultsReady = true) {
      if (disposed) return;
      count = resultCount;
      ready = resultsReady;
      if (value !== query) {
        query = value;
        cancel(timer);
        timer = undefined;
        if (!query.trim()) { settled = undefined; return; }
        timer = schedule(settle, 500);
      } else if (timer === undefined) {
        // The text quiet period may finish before VitePress loads its index or
        // completes highlighting. Readiness resumes it without another delay.
        settle();
      }
    },
    click(position) {
      if (disposed || !query.trim() || !Number.isInteger(position) || position < 0 || position >= count) return;
      const linked = ready && timer === undefined && settled?.query === query;
      send('result_clicked_v2', { position, result_count: count, search_pending: !linked, ...(linked ? { search_id: settled.id } : {}) });
    },
    dispose() {
      disposed = true;
      cancel(timer);
      query = '';
      settled = undefined;
    },
  };
}

export function attachSearchAnalytics(capture, doc = document, Observer = MutationObserver) {
  let box;
  let input;
  let tracker;
  const results = () => [...box.querySelectorAll('.result')];
  const sync = () => {
    if (!tracker) return;
    const count = results().length;
    const list = box.querySelector('ul.results');
    const ready = list?.getAttribute('aria-busy') === 'false' &&
      (count > 0 || Boolean(list.querySelector('.no-results')));
    tracker.update(input.value, count, ready);
  };
  const click = (event) => {
    const result = event.target?.closest?.('.result');
    if (!result) return;
    sync();
    tracker.click(results().indexOf(result));
  };
  const keydown = (event) => {
    // Links already produce click events on Enter; only the search input uses
    // VitePress's programmatic selection/navigation path.
    if (event.key !== 'Enter' || event.isComposing || event.target !== input) return;
    sync();
    tracker.click(results().indexOf(box.querySelector('.result.selected')));
  };
  const detach = () => {
    input?.removeEventListener('input', sync);
    box?.removeEventListener('click', click, true);
    box?.removeEventListener('keydown', keydown, true);
    tracker?.dispose();
    box = input = tracker = undefined;
  };
  const reconcile = () => {
    const next = doc.querySelector('.VPLocalSearchBox');
    if (next !== box) {
      detach();
      const nextInput = next?.querySelector('input');
      if (nextInput) {
        box = next;
        input = nextInput;
        tracker = createSearchTracker({ capture });
        input.addEventListener('input', sync);
        box.addEventListener('click', click, true);
        box.addEventListener('keydown', keydown, true);
      }
    }
    if (tracker) sync();
  };
  const observer = new Observer(reconcile);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  reconcile();
  return () => { observer.disconnect(); detach(); };
}
