'use strict'

// Request-layer behaviour (encoding, response parsing, transport errors,
// timeouts), tested through WdkIndexerClient with fetch as the only seam.
// URL, header, body and API-key rules per endpoint live in test/client.js.

const test = require('brittle')
const { WdkIndexerClient } = require('../lib/client.js')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError
} = require('../lib/errors.js')
const { reply, mockFetch, rejects } = require('./helpers')

const KEY = 'test-key'
const client = (options) => new WdkIndexerClient({ apiKey: KEY, ...options })

test('query keys and values are encoded', async (t) => {
  const fetch = mockFetch()
  await client({ fetch }).getTransfers({ 'a b': 'x&y=z', from: '2025-01-01T00:00:00+01:00' })
  t.is(fetch.calls[0].url, 'https://wdk-api.tether.su/api/v1/transfers?a%20b=x%26y%3Dz&from=2025-01-01T00%3A00%3A00%2B01%3A00')
})

test('2xx empty body resolves to null', async (t) => {
  const fetch = mockFetch(() => reply(204))
  t.is(await client({ fetch }).deleteWallet('w1'), null)
})

test('2xx non-JSON body rejects with WdkIndexerError', async (t) => {
  const fetch = mockFetch(() => reply(200, 'not json'))
  const err = await rejects(t, client({ fetch }).listWallets(), WdkIndexerError, /^Invalid JSON in response \(HTTP 200\)$/)
  t.absent(err instanceof WdkIndexerApiError)
})

test('non-JSON and empty error bodies use the status line', async (t) => {
  const html = mockFetch(() => reply(502, '<html>bad gateway</html>', 'Bad Gateway'))
  const raw = await rejects(t, client({ fetch: html }).listWallets(), WdkIndexerApiError, /^HTTP 502 Bad Gateway$/)
  t.is(raw.status, 502)
  t.is(raw.errorType, null)
  t.is(raw.body, '<html>bad gateway</html>')

  const empty = mockFetch(() => reply(500, undefined, 'Internal Server Error'))
  const err = await rejects(t, client({ fetch: empty }).listWallets(), WdkIndexerApiError, /^HTTP 500 Internal Server Error$/)
  t.is(err.status, 500)
  t.is(err.errorType, null)
  t.is(err.body, null)
})

test('fetch rejection maps to WdkIndexerNetworkError with cause', async (t) => {
  const cause = new Error('ECONNREFUSED')
  const fetch = async () => { throw cause }
  const err = await rejects(t, client({ fetch }).listWallets(), WdkIndexerNetworkError, /^Network request failed: ECONNREFUSED$/)
  t.is(err.cause, cause)
})

test('body read failure maps to WdkIndexerNetworkError', async (t) => {
  const cause = new Error('socket hang up')
  const fetch = async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => { throw cause } })
  const err = await rejects(t, client({ fetch }).listWallets(), WdkIndexerNetworkError, /socket hang up/)
  t.is(err.cause, cause)
})

// Swap a global for the duration of one test.
function swapGlobal (t, name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name)
  const original = globalThis[name]
  globalThis[name] = value
  t.teardown(() => {
    if (had) globalThis[name] = original
    else delete globalThis[name]
  })
}

// Spy on setTimeout/clearTimeout; returns the { id, ms } of every timer armed.
function spyTimers (t) {
  const realSet = globalThis.setTimeout
  const realClear = globalThis.clearTimeout
  const timers = []
  const cleared = new Set()
  swapGlobal(t, 'setTimeout', (fn, ms) => {
    const id = realSet(fn, ms)
    timers.push({ id, ms })
    return id
  })
  swapGlobal(t, 'clearTimeout', (id) => {
    cleared.add(id)
    realClear(id)
  })
  const last = (ms) => timers.filter((timer) => timer.ms === ms).pop()
  return { timers, cleared, last }
}

test('timer is cleared after success, error and timeout', async (t) => {
  const spy = spyTimers(t)

  await client({ timeout: 4001, fetch: mockFetch() }).listWallets()
  t.ok(spy.cleared.has(spy.last(4001).id), 'cleared after success')

  await client({ timeout: 4002, fetch: async () => { throw new Error('x') } }).listWallets().catch(() => {})
  t.ok(spy.cleared.has(spy.last(4002).id), 'cleared after network error')

  await client({ timeout: 10, fetch: () => new Promise(() => {}) }).listWallets().catch(() => {})
  t.ok(spy.cleared.has(spy.last(10).id), 'cleared after timeout')
  t.is(spy.timers.filter((timer) => timer.ms === 10).length, 1, 'one timer per request')
})

// Stand-in for runtimes without AbortController (Bare).
class FakeAbortController {
  constructor () {
    const listeners = []
    this.signal = { aborted: false, addEventListener: (type, fn) => listeners.push(fn) }
    this.listeners = listeners
  }

  abort () {
    this.signal.aborted = true
    for (const fn of this.listeners) fn()
  }
}

test('passes a signal and aborts it on timeout when AbortController exists', async (t) => {
  if (typeof globalThis.AbortController !== 'function') swapGlobal(t, 'AbortController', FakeAbortController)
  const fetch = mockFetch(() => new Promise(() => {}))
  await rejects(t, client({ timeout: 10, fetch }).listWallets(), WdkIndexerTimeoutError, /timed out/)
  const { signal } = fetch.calls[0]
  t.ok(signal, 'signal passed')
  t.is(signal.aborted, true, 'signal aborted')
})

test('a fetch that rejects on abort still gives WdkIndexerTimeoutError', async (t) => {
  if (typeof globalThis.AbortController !== 'function') swapGlobal(t, 'AbortController', FakeAbortController)
  const fetch = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const err = new Error('This operation was aborted')
      err.name = 'AbortError'
      reject(err)
    })
  })
  const err = await rejects(t, client({ timeout: 10, fetch }).listWallets(), WdkIndexerTimeoutError, /^Request timed out after 10ms$/)
  t.is(err.timeout, 10)
  // Let the aborted fetch settle; an unhandled rejection would fail the run.
  await new Promise((resolve) => setTimeout(resolve, 20))
})

test('passes no signal when AbortController is absent', async (t) => {
  swapGlobal(t, 'AbortController', undefined)
  const fetch = mockFetch()
  await client({ fetch }).listWallets()
  t.absent('signal' in fetch.calls[0])
})

// Local HTTP server that echoes each request as JSON. Works on Node and Bare
// (bare-http1 comes with bare-fetch).
function echoServer (t) {
  const http = typeof Bare !== 'undefined' ? require('bare-http1') : require('http')
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Connection', 'close')
      res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body }))
    })
  })
  t.teardown(() => new Promise((resolve) => server.close(resolve)))
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port))
  })
}

test('default fetch (#fetch) reaches a real server on this runtime', async (t) => {
  const baseUrl = await echoServer(t)
  const c = new WdkIndexerClient({ baseUrl, apiKey: KEY })

  const got = await c.getChains()
  t.is(got.method, 'GET')
  t.is(got.url, '/api/v1/chains')
  t.is(got.headers.accept, 'application/json')
  t.absent('x-api-key' in got.headers)

  const listed = await c.getTransfers({ limit: 1 })
  t.is(listed.url, '/api/v1/transfers?limit=1')
  t.is(listed.headers['x-api-key'], KEY)

  const body = [{ blockchain: 'ethereum', token: 'usdt', address: '0xabc', limit: 5 }]
  const posted = await c.getBatchTokenTransfers(body)
  t.is(posted.method, 'POST')
  t.is(posted.headers['content-type'], 'application/json')
  t.alike(JSON.parse(posted.body), body, 'POST body arrives intact')
})
