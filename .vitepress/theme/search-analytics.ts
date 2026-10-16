// Query identity is local, exact and ephemeral. Only a random attempt ID leaves
// this module. The 500ms timer affects measurement, never VitePress search.
import type { CaptureSearchEvent, SearchEventName } from './analytics.ts';

type SearchSnapshot = {
  count: number;
  ready: boolean;
  value: string;
};

type TimerHandle = number | ReturnType<typeof setTimeout>;

type TrackerOptions = {
  cancel?: (timer: TimerHandle | undefined) => void;
  capture: CaptureSearchEvent;
  randomUUID?: () => string;
  readCurrent?: () => SearchSnapshot | undefined;
  schedule?: (callback: () => void, delay: number) => TimerHandle;
};
export const createSearchTracker = ({
  cancel = clearTimeout,
  capture,
  randomUUID = () => crypto.randomUUID(),
  readCurrent,
  schedule = setTimeout,
}: TrackerOptions) => {
  let query = '';
  let count = 0;
  let ready = false;
  let settled: undefined | { count: number; id: string; query: string };
  let timer: TimerHandle | undefined;
  let disposed = false;
  const send: CaptureSearchEvent = (event, properties) => {
    try {
      capture(event, properties);
    } catch {
      /* Fail open for the search UI. */
    }
  };
  const reportResults = (event: SearchEventName, id: string) => {
    const properties = { result_count: count, search_id: id };
    send(event, properties);
    if (count === 0) send('search_zero_results_v2', properties);
  };
  const work = {
    settle: () => {
      timer = undefined;
      if (disposed) return;
      // VitePress can update its input value without dispatching `input` (for
      // example, when its clear button resets filterText). Re-read the live DOM
      // before attributing a quiet-period timer to the cached query.
      const current = readCurrent?.();
      if (current) {
        if (current.value !== query) {
          work.update(current.value, current.count, current.ready);
          return;
        }
        count = current.count;
        ready = current.ready;
      }
      if (!ready || !query.trim()) return;
      if (settled?.query === query) {
        if (settled.count !== count) {
          settled.count = count;
          reportResults('search_results_updated_v2', settled.id);
        }
        return;
      }
      settled = { count, id: randomUUID(), query };
      reportResults('catalog_search_v2', settled.id);
    },
    update: (value: string, resultCount: number, resultsReady = true) => {
      if (disposed) return;
      count = resultCount;
      ready = resultsReady;
      if (value !== query) {
        query = value;
        cancel(timer);
        timer = undefined;
        if (!query.trim()) {
          settled = undefined;
          return;
        }
        timer = schedule(work.settle, 500);
      } else if (timer === undefined) {
        // The text quiet period may finish before VitePress loads its index or
        // completes highlighting. Readiness resumes it without another delay.
        work.settle();
      }
    },
  };
  return {
    click(position: number) {
      if (
        disposed ||
        !query.trim() ||
        !Number.isSafeInteger(position) ||
        position < 0 ||
        position >= count
      )
        return;
      const linked = ready && timer === undefined && settled?.query === query;
      send('result_clicked_v2', {
        position,
        result_count: count,
        search_pending: !linked,
        ...(linked && settled && { search_id: settled.id }),
      });
    },
    dispose() {
      disposed = true;
      cancel(timer);
      query = '';
      settled = undefined;
    },
    update: work.update,
  };
};

export const attachSearchAnalytics = (
  capture: CaptureSearchEvent,
  doc = document,
  Observer = MutationObserver,
) => {
  let box: HTMLElement | undefined;
  let input: HTMLInputElement | undefined;
  let tracker: ReturnType<typeof createSearchTracker> | undefined;
  const results = () => [...(box?.querySelectorAll('.result') ?? [])];
  const sync = () => {
    if (!tracker || !input || !box) return;
    const count = results().length;
    const list = box.querySelector('ul.results');
    const ready =
      list?.getAttribute('aria-busy') === 'false' &&
      (count > 0 || Boolean(list.querySelector('.no-results')));
    tracker.update(input.value, count, ready);
  };
  const click = (event: MouseEvent) => {
    const result = (event.target as Element | null)?.closest('.result');
    if (!result) return;
    sync();
    tracker?.click(results().indexOf(result));
  };
  const keydown = (event: KeyboardEvent) => {
    // Links already produce click events on Enter; only the search input uses
    // VitePress's programmatic selection/navigation path.
    if (
      event.key !== 'Enter' ||
      event.isComposing ||
      !Object.is(event.target, input)
    )
      return;
    sync();
    const selected = box?.querySelector('.result.selected');
    tracker?.click(selected ? results().indexOf(selected) : -1);
  };
  const detach = () => {
    input?.removeEventListener('input', sync);
    box?.removeEventListener('click', click, true);
    box?.removeEventListener('keydown', keydown, true);
    tracker?.dispose();
    box = undefined;
    input = undefined;
    tracker = undefined;
  };
  const reconcile = () => {
    const next = doc.querySelector<HTMLElement>('.VPLocalSearchBox');
    if (!Object.is(next, box)) {
      detach();
      const nextInput = next?.querySelector('input');
      if (next && nextInput) {
        box = next;
        input = nextInput;
        tracker = createSearchTracker({
          capture,
          readCurrent: () => {
            const count = results().length;
            const list = next.querySelector('ul.results');
            return {
              count,
              ready:
                list?.getAttribute('aria-busy') === 'false' &&
                (count > 0 || Boolean(list.querySelector('.no-results'))),
              value: nextInput.value,
            };
          },
        });
        input.addEventListener('input', sync);
        box.addEventListener('click', click, { capture: true });
        box.addEventListener('keydown', keydown, { capture: true });
      }
    }
    if (tracker) sync();
  };
  const observer = new Observer(reconcile);
  observer.observe(doc.body, {
    attributeFilter: ['aria-busy'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  reconcile();
  return () => {
    observer.disconnect();
    detach();
  };
};
