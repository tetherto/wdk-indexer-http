'use strict'

const test = require('brittle')
const { WdkIndexerClient } = require('../lib/client.js')
const { WdkIndexerError, WdkIndexerApiError, WdkIndexerTimeoutError } = require('../lib/errors.js')
const { reply, mockFetch, rejects } = require('./helpers')

const KEY = 'test-key'
const BASE = 'https://wdk-api.tether.io/api/v1'
const ADDR = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const TX = '0x' + 'ab'.repeat(32)

const GET_HEADERS = { Accept: 'application/json', 'X-API-KEY': KEY }
const BODY_HEADERS = { ...GET_HEADERS, 'Content-Type': 'application/json' }

const batch = [
  { blockchain: 'ethereum', token: 'usdt', address: ADDR, limit: 5 },
  { blockchain: 'tron', token: 'usdt', address: 'TXYZ' }
]
const wallets = [{ name: 'main', addresses: { ethereum: ADDR } }]
const tooMany = Array.from({ length: 11 }, () => ({ blockchain: 'ethereum', token: 'usdt', address: ADDR }))
const looseBatch = [{ blockchain: 'ethereum', token: 'usdt', address: ADDR, limit: 5000, fromTs: -1, extra: true }]

// [method, args, HTTP method, URL after /api/v1, request body]
const cases = [
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR], 'GET', '/ethereum/usdt/' + ADDR + '/token-transfers'],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 10, fromTs: 0, toTs: 1700000000 }], 'GET',
    '/ethereum/usdt/' + ADDR + '/token-transfers?limit=10&fromTs=0&toTs=1700000000'],
  ['getTokenBalance', ['ton', 'usdt', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'], 'GET', '/ton/usdt/EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs/token-balances'],
  ['getTransactionTransfers', ['ethereum', 'usdt', TX], 'GET', '/blockchains/ethereum/usdt/token-transfers/' + TX],
  ['getBatchTokenTransfers', [batch], 'POST', '/batch/token-transfers', batch],
  ['getBatchTokenBalances', [batch], 'POST', '/batch/token-balances', batch],
  ['registerWallets', [wallets], 'POST', '/wallets', wallets],
  ['listWallets', [], 'GET', '/wallets'],
  ['updateWallet', ['w1', { name: 'renamed' }], 'PATCH', '/wallets/w1', { name: 'renamed' }],
  ['updateWallet', ['w1', { enabled: false }], 'PATCH', '/wallets/w1', { enabled: false }],
  ['deleteWallet', ['w1'], 'DELETE', '/wallets/w1'],
  ['getWalletTransfers', ['w1'], 'GET', '/wallets/w1/transfers'],
  ['getWalletTransfers', ['w1', {
    blockchain: 'ethereum',
    token: 'usdt',
    type: 'sent',
    from: '2025-01-01T00:00:00+01:00',
    to: 1700000000,
    limit: 100,
    skip: 0,
    sort: 'asc'
  }], 'GET', '/wallets/w1/transfers?blockchain=ethereum&token=usdt&type=sent' +
    '&from=2025-01-01T00%3A00%3A00%2B01%3A00&to=1700000000&limit=100&skip=0&sort=asc'],
  ['getTransfers', [], 'GET', '/transfers'],
  ['getTransfers', [{ type: 'received', limit: 1, sort: 'desc' }], 'GET',
    '/transfers?type=received&limit=1&sort=desc'],
  // Options are sent as given, in key order; unknown keys are left for the server.
  ['getWalletTransfers', ['w1', { sort: 'asc', blockchain: 'tron', page: 2 }], 'GET', '/wallets/w1/transfers?sort=asc&blockchain=tron&page=2'],
  // Batch sizes are left for the server, which enforces 1 to 10 items.
  ['getBatchTokenBalances', [tooMany], 'POST', '/batch/token-balances', tooMany],
  ['registerWallets', [[]], 'POST', '/wallets', []],
  // Option values, wallet fields and batch item contents are left for the server.
  ['getTransfers', [{ limit: 5000, sort: 'newest' }], 'GET', '/transfers?limit=5000&sort=newest'],
  ['updateWallet', ['w1', {}], 'PATCH', '/wallets/w1', {}],
  ['getTransactionTransfers', ['ethereum', 'usdt', 'a'.repeat(300)], 'GET', '/blockchains/ethereum/usdt/token-transfers/' + 'a'.repeat(300)],
  ['getBatchTokenTransfers', [looseBatch], 'POST', '/batch/token-transfers', looseBatch],
  ['registerWallets', [[{ addresses: { plasma: 'x' } }]], 'POST', '/wallets', [{ addresses: { plasma: 'x' } }]]
]

for (const [name, args, method, path, body] of cases) {
  test(name + ' sends ' + method + ' ' + path, async (t) => {
    const result = { name, items: [1, 2, 3] }
    const fetch = mockFetch(() => reply(200, result))
    const client = new WdkIndexerClient({ apiKey: KEY, fetch })

    t.alike(await client[name](...args), result, 'returns the parsed body unchanged')
    t.is(fetch.calls.length, 1)
    const call = fetch.calls[0]
    t.is(call.method, method)
    t.is(call.url, BASE + path)
    t.alike(call.headers, body === undefined ? GET_HEADERS : BODY_HEADERS)
    t.is(call.body, body === undefined ? undefined : JSON.stringify(body))
  })

  test(name + ' requires an API key', async (t) => {
    const fetch = mockFetch()
    for (const apiKey of [undefined, '']) {
      const err = await rejects(t, new WdkIndexerClient({ apiKey, fetch })[name](...args), WdkIndexerError, /^API key is required$/)
      t.is(err.constructor, WdkIndexerError, 'the base class, not a subclass')
    }
    t.is(fetch.calls.length, 0, 'fetch not called')
  })
}

test('health and getChains need no key and never send X-API-KEY', async (t) => {
  for (const apiKey of [undefined, KEY]) {
    const fetch = mockFetch((url) => reply(200, { url }))
    const client = new WdkIndexerClient({ apiKey, fetch })

    t.alike(await client.health(), { url: BASE + '/health' })
    t.alike(await client.getChains(), { url: BASE + '/chains' })
    for (const call of fetch.calls) {
      t.is(call.method, 'GET')
      t.alike(call.headers, { Accept: 'application/json' })
      t.is(call.body, undefined)
    }
  }
})

test('health resolves with the body on 503 (degraded or unhealthy)', async (t) => {
  for (const status of ['degraded', 'unhealthy']) {
    const body = { status, timestamp: '2025-01-01T00:00:00.000Z' }
    const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(503, body, 'Service Unavailable')) })
    t.alike(await client.health(), body, status)
  }
})

test('health rejects a 503 without a JSON body', async (t) => {
  for (const text of ['<html>503</html>', '']) {
    const fetch = async () => ({ ok: false, status: 503, statusText: 'Service Unavailable', text: async () => text })
    const err = await rejects(t, new WdkIndexerClient({ fetch }).health(), WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
    t.is(err.status, 503)
  }
})

test('health throws on other error statuses', async (t) => {
  const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(500, { error: 'Internal', message: 'boom' })) })
  const err = await rejects(t, client.health(), WdkIndexerApiError, /^boom$/)
  t.is(err.status, 500)
  for (const status of [400, 404, 502]) {
    const other = new WdkIndexerClient({ fetch: mockFetch(() => reply(status, { status: 'unhealthy' }, 'Err')) })
    const e = await rejects(t, other.health(), WdkIndexerApiError, /^HTTP \d+ Err$/)
    t.is(e.status, status)
  }
})

test('getChains throws WdkIndexerApiError on 500', async (t) => {
  const body = { error: 'Internal Server Error', message: 'Failed to load chains' }
  const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(500, body, 'Internal Server Error')) })
  const err = await rejects(t, client.getChains(), WdkIndexerApiError, /^Failed to load chains$/)
  t.is(err.status, 500)
  t.is(err.errorType, 'Internal Server Error')
})

test('getChains throws WdkIndexerApiError on 503', async (t) => {
  const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(503, undefined, 'Service Unavailable')) })
  const err = await rejects(t, client.getChains(), WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
  t.is(err.status, 503)
})

test('API errors surface status, errorType and message', async (t) => {
  const body = { error: 'Bad Request', message: 'Unsupported blockchain: plasma' }
  const client = new WdkIndexerClient({ apiKey: KEY, fetch: mockFetch(() => reply(400, body, 'Bad Request')) })
  const err = await rejects(t, client.getTokenBalance('plasma', 'usdt', ADDR), WdkIndexerApiError, /^Unsupported blockchain: plasma$/)
  t.is(err.status, 400)
  t.is(err.errorType, 'Bad Request')
  t.alike(err.body, body)
})

test('unknown chains and tokens are sent to the server', async (t) => {
  const fetch = mockFetch()
  const client = new WdkIndexerClient({ apiKey: KEY, fetch })
  await client.getTokenBalance('plasma', 'doge', ADDR)
  await client.getBatchTokenBalances([{ blockchain: 'plasma', token: 'doge', address: ADDR }])
  t.is(fetch.calls.length, 2)
})

test('a user-supplied fetch overrides #fetch', async (t) => {
  const original = globalThis.fetch
  let globalCalls = 0
  globalThis.fetch = async () => {
    globalCalls++
    return reply(200, {})
  }
  try {
    const fetch = mockFetch(() => reply(200, { from: 'user' }))
    t.alike(await new WdkIndexerClient({ fetch }).getChains(), { from: 'user' })
    t.is(fetch.calls.length, 1)
    t.is(globalCalls, 0, 'global fetch not used')
  } finally {
    globalThis.fetch = original
  }
})

test('baseUrl trailing slashes are stripped', async (t) => {
  for (const baseUrl of ['http://localhost:3000', 'http://localhost:3000/', 'http://localhost:3000///']) {
    const fetch = mockFetch()
    await new WdkIndexerClient({ baseUrl, fetch }).health()
    t.is(fetch.calls[0].url, 'http://localhost:3000/api/v1/health', baseUrl)
  }
})

test('defaults to the public base URL', async (t) => {
  const fetch = mockFetch()
  await new WdkIndexerClient({ fetch }).getChains()
  t.is(fetch.calls[0].url, 'https://wdk-api.tether.io/api/v1/chains')
})

test('timeout option is passed to requests', async (t) => {
  const client = new WdkIndexerClient({ timeout: 20, fetch: () => new Promise(() => {}) })
  const err = await rejects(t, client.getChains(), WdkIndexerTimeoutError, /^Request timed out after 20ms$/)
  t.is(err.timeout, 20)
})

test('timeout defaults to 30000ms', async (t) => {
  const realSet = globalThis.setTimeout
  const delays = []
  globalThis.setTimeout = (fn, ms) => {
    delays.push(ms)
    return realSet(fn, ms)
  }
  try {
    await new WdkIndexerClient({ fetch: mockFetch() }).getChains()
  } finally {
    globalThis.setTimeout = realSet
  }
  t.ok(delays.includes(30000), 'timer armed with 30000ms')
})

// A TON address in standard base64 contains '/' and '+'.
test('addresses are URI-encoded', async (t) => {
  const fetch = mockFetch()
  const client = new WdkIndexerClient({ apiKey: KEY, fetch })
  const address = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id/sDs+'
  await client.getTokenBalance('ton', 'usdt', address)
  await client.getTokenTransfers('ton', 'usdt', address)
  t.is(fetch.calls[0].url, BASE + '/ton/usdt/EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id%2FsDs%2B/token-balances')
  t.is(fetch.calls[1].url, BASE + '/ton/usdt/EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id%2FsDs%2B/token-transfers')
})

// Every method is async, so a throw while building the path becomes a rejection.
test('a malformed address rejects instead of throwing', async (t) => {
  const p = new WdkIndexerClient({ apiKey: KEY, fetch: mockFetch() }).getTokenBalance('ton', 'usdt', '\uD800') // lone surrogate
  t.ok(p instanceof Promise, 'returns a promise')
  await t.exception(p, URIError)
})

// Other path values go into the URL as given (see "Path parameters" in the README).
test('non-address path values are inserted without encoding', async (t) => {
  const fetch = mockFetch()
  const client = new WdkIndexerClient({ apiKey: KEY, fetch })
  await client.getWallet('a/b')
  await client.getWallet('a%2Fb') // already encoded by the caller: sent once, not twice
  t.is(fetch.calls[0].url, BASE + '/wallets/a/b')
  t.is(fetch.calls[1].url, BASE + '/wallets/a%2Fb')
})

test('the API key is private', (t) => {
  const client = new WdkIndexerClient({ apiKey: KEY })
  t.alike(Object.keys(client).sort(), ['_fetch', '_origin', '_timeout'], 'only the non-secret config is visible')
  t.is(client.apiKey, undefined)
  t.is(client._apiKey, undefined)
  t.absent(JSON.stringify(client).includes(KEY), 'API key not serialized')
})
