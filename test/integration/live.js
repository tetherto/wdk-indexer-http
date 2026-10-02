'use strict'

// Live tests against the WDK Indexer API, run through the package entry.
//   npm run test:integration                                   health + chains only
//   WDK_INDEXER_API_KEY=... npm run test:integration           + authenticated reads
//   ... WDK_INDEXER_WALLET_TESTS=1 npm run test:integration    + wallet create/update/delete
//   WDK_INDEXER_BASE_URL=...                                   targets another deployment

const test = require('brittle')
const { WdkIndexerClient, WdkIndexerApiError, isApiError } = require('../../index.js')

// Bare has no global process. bare-process is not a declared dependency: it is
// installed because brittle depends on it, and is only required under Bare.
const env = globalThis.process ? globalThis.process.env : require('bare-process').env

const API_KEY = env.WDK_INDEXER_API_KEY || undefined
const WALLET_TESTS = env.WDK_INDEXER_WALLET_TESTS === '1'
const BASE_URL = env.WDK_INDEXER_BASE_URL || undefined

const ETH_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7' // USDt contract on Ethereum
const TRON_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' // USDt contract on Tron

const client = new WdkIndexerClient({ apiKey: API_KEY, baseUrl: BASE_URL, timeout: 20000 })

/** Runs `fn` only when an API key is configured. */
function authed (name, fn) {
  if (API_KEY) return test(name, fn)
  test.skip(`${name} (skipped: set WDK_INDEXER_API_KEY)`, fn)
}

/** Runs `fn` only when wallet tests are enabled; they create and delete server state. */
function mutating (name, fn) {
  if (API_KEY && WALLET_TESTS) return test(name, fn)
  test.skip(`${name} (skipped: set WDK_INDEXER_API_KEY and WDK_INDEXER_WALLET_TESTS=1)`, fn)
}

test('health() returns the service status', async (t) => {
  const health = await client.health()
  t.ok(['healthy', 'degraded', 'unhealthy'].includes(health.status), `status is ${health.status}`)
  t.is(typeof health.timestamp, 'string')
})

test('getChains() lists blockchains with their tokens', async (t) => {
  const { chains } = await client.getChains()
  t.ok(Array.isArray(chains) && chains.length > 0)
  const ethereum = chains.find((c) => c.name === 'ethereum')
  t.ok(ethereum, 'ethereum is listed')
  t.ok(ethereum.tokens.includes('usdt'), 'ethereum supports usdt')
})

test('a bogus API key is rejected with WdkIndexerApiError', async (t) => {
  const bogus = new WdkIndexerClient({ apiKey: 'not-a-real-key', baseUrl: BASE_URL, timeout: 20000 })
  try {
    await bogus.listWallets()
    t.fail('expected a rejection')
  } catch (err) {
    t.ok(err instanceof WdkIndexerApiError, err.name)
    t.ok(err.status === 401 || err.status === 403, `status is ${err.status}`)
    t.is(typeof err.message, 'string')
  }
})

authed('getTokenBalance() returns a balance', async (t) => {
  const { tokenBalance } = await client.getTokenBalance('ethereum', 'usdt', ETH_ADDRESS)
  t.is(tokenBalance.blockchain, 'ethereum')
  t.is(tokenBalance.token, 'usdt')
  t.ok(tokenBalance.amount !== undefined, 'has an amount')
})

authed('getTokenTransfers() and getTransactionTransfers() return transfers', async (t) => {
  const { transfers } = await client.getTokenTransfers('ethereum', 'usdt', ETH_ADDRESS, { limit: 5 })
  t.ok(Array.isArray(transfers) && transfers.length <= 5)

  if (transfers.length === 0) {
    t.comment('no transfers returned, getTransactionTransfers() not exercised')
    return
  }
  const hash = transfers[0].transactionHash
  t.is(typeof hash, 'string')
  const byTx = await client.getTransactionTransfers('ethereum', 'usdt', hash)
  t.ok(Array.isArray(byTx.transfers) && byTx.transfers.length > 0)
  t.ok(byTx.transfers.every((tr) => tr.transactionHash === hash), 'every transfer has the hash')
})

authed('getBatchTokenBalances() answers in request order', async (t) => {
  const results = await client.getBatchTokenBalances([
    { blockchain: 'ethereum', token: 'usdt', address: ETH_ADDRESS },
    { blockchain: 'tron', token: 'usdt', address: TRON_ADDRESS }
  ])
  t.is(results.length, 2)
  results.forEach((r, i) => {
    t.ok(isApiError(r) || r.tokenBalance, `item ${i} is a balance or an error`)
  })
})

authed('getBatchTokenTransfers() answers in request order', async (t) => {
  const results = await client.getBatchTokenTransfers([
    { blockchain: 'ethereum', token: 'usdt', address: ETH_ADDRESS, limit: 2 },
    { blockchain: 'tron', token: 'usdt', address: TRON_ADDRESS, limit: 2 }
  ])
  t.is(results.length, 2)
  results.forEach((r, i) => {
    t.ok(isApiError(r) || Array.isArray(r.transfers), `item ${i} is a transfer list or an error`)
  })
})

authed('listWallets() and getTransfers() return lists', async (t) => {
  const { wallets } = await client.listWallets()
  t.ok(Array.isArray(wallets))
  const { transfers } = await client.getTransfers({ limit: 5, sort: 'desc' })
  t.ok(Array.isArray(transfers) && transfers.length <= 5)
})

mutating('wallet lifecycle: register, get, update, transfers, delete', async (t) => {
  const name = `wdk-indexer-http-it-${Date.now()}`
  const { wallets } = await client.registerWallets([
    { type: 'client_wallet', name, addresses: { ethereum: ETH_ADDRESS } }
  ])
  const created = wallets[0]
  t.is(created.status, 201, 'wallet created')
  const id = created.id
  t.is(typeof id, 'string')

  let deleted = false
  t.teardown(async () => {
    if (!deleted) await client.deleteWallet(id).catch(() => {})
  })

  const wallet = await client.getWallet(id)
  t.is(wallet.id, id)
  t.is(wallet.name, name)

  const renamed = await client.updateWallet(id, { name: `${name}-renamed` })
  t.is(renamed.name, `${name}-renamed`)
  const disabled = await client.updateWallet(id, { enabled: false })
  t.is(disabled.enabled, false)

  const { transfers } = await client.getWalletTransfers(id, { limit: 5 })
  t.ok(Array.isArray(transfers))

  const result = await client.deleteWallet(id)
  deleted = true
  t.is(result.success, true)

  try {
    await client.getWallet(id)
    t.fail('expected a 404 after delete')
  } catch (err) {
    t.ok(err instanceof WdkIndexerApiError && err.status === 404, 'wallet is gone')
  }
})
