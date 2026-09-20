import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('navigation lets a slow body finish after headers, and uses cached HTML on a fetch failure', async () => {
  const version = 'test-build';
  const index = 'https://example.test/oppdretter/index.html';
  const html = `<meta name="app-build" content="${version}">fresh page`;
  const listeners = new Map<string, (event: any) => void>();
  const timers = new Map<number, { due: number; callback: () => void }>();
  let clock = 0;
  let timerId = 0;
  let signal: AbortSignal;
  let failFetch = false;
  let cacheReads = 0;
  const cachedPage = { source: 'previous offline page' };
  let savedPage: any = cachedPage;
  const writes: string[] = [];
  let receiveHeaders!: (response: any) => void;
  const headers = new Promise(resolve => { receiveHeaders = resolve; });
  let finishBody!: (text: string) => void;
  let abortBody!: (error: Error) => void;
  const body = new Promise<string>((resolve, reject) => {
    finishBody = resolve;
    abortBody = reject;
  });
  let startedBody!: () => void;
  const readingBody = new Promise<void>(resolve => { startedBody = resolve; });
  const onlinePage = {
    ok: true,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    clone() { return this; },
    text() { startedBody(); return body; },
  };
  const source = readFileSync(new URL('../scripts/service-worker.js', import.meta.url), 'utf8')
    .replace('__BUILD_VERSION__', version)
    .replace('__PRECACHE_FILES__', '[]');
  runInNewContext(source, {
    URL,
    AbortController,
    self: {
      registration: { scope: 'https://example.test/oppdretter/' },
      addEventListener: (type: string, handler: (event: any) => void) => listeners.set(type, handler),
    },
    setTimeout: (callback: () => void, delay: number) => {
      timers.set(++timerId, { due: clock + delay, callback });
      return timerId;
    },
    clearTimeout: (id: number) => { timers.delete(id); },
    fetch: async (_request: any, options: { signal: AbortSignal }) => {
      if (failFetch) throw new TypeError('Network unavailable');
      signal = options.signal;
      signal.addEventListener('abort', () => abortBody(new Error('Body download aborted')), { once: true });
      return headers;
    },
    caches: {
      open: async () => ({
        match: async (url: string) => {
          assert.equal(url, index);
          cacheReads++;
          return savedPage;
        },
        put: async (url: string, response: any) => { writes.push(url); savedPage = response; },
      }),
    },
  });
  function navigate(): Promise<any> {
    let result!: Promise<any>;
    listeners.get('fetch')!({
      request: { url: index, method: 'GET', mode: 'navigate' },
      respondWith: (response: Promise<any>) => { result = response; },
    });
    assert.ok(result, 'the worker must handle the home navigation');
    return result;
  }

  const navigation = navigate();
  assert.equal(timers.size, 1, 'waiting for response headers remains time-limited');
  receiveHeaders(onlinePage);
  await readingBody;
  // Headers have arrived, but the body stays pending beyond the original deadline.
  clock = 8000;
  for (const [id, timer] of timers) {
    if (timer.due <= clock) { timers.delete(id); timer.callback(); }
  }
  finishBody(html);
  const result = await navigation;
  assert.equal(signal!.aborted, false, 'the old header timeout must not abort the HTML body');
  assert.equal(result, onlinePage);
  assert.equal(cacheReads, 0, 'slow valid HTML must not silently fall back to an older page');
  assert.deepEqual(writes, [index]);
  assert.equal(timers.size, 0);

  failFetch = true;
  savedPage = cachedPage;
  assert.equal(await navigate(), cachedPage, 'a genuine fetch failure still uses the offline page');
  assert.equal(cacheReads, 1);
  assert.equal(timers.size, 0, 'failed requests also release their timeout');
});
