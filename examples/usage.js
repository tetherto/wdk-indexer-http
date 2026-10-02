'use strict'

// Walk through the WDK Indexer API with @tetherto/wdk-indexer-http.
//   node examples/usage.js                                   health + chains only
//   WDK_INDEXER_API_KEY=... node examples/usage.js           + every read method
//   WDK_INDEXER_API_KEY=... node examples/usage.js --wallets + register, update, delete a wallet
//   WDK_INDEXER_BASE_URL=...                                 targets another deployment

const {
  WdkIndexerClient,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError
} = require('@tetherto/wdk-indexer-http')

const ETH_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const TRON_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const client = new WdkIndexerClient({
  apiKey: process.env.WDK_INDEXER_API_KEY,
  baseUrl: process.env.WDK_INDEXER_BASE_URL,
  timeout: 20000
})

async function publicEndpoints () {
  const health = await client.health() // resolves on 200 and 503
  console.log('health:', health.status, health.summary)

  const { chains } = await client.getChains()
  for (const chain of chains) console.log(`  ${chain.name}: ${chain.tokens.join(', ')}`)
}

async function addressLookups () {
  const { tokenBalance } = await client.getTokenBalance('ethereum', 'usdt', ETH_ADDRESS)
  console.log('balance:', tokenBalance.amount, tokenBalance.token)

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000 // timestamps are milliseconds
  const { transfers } = await client.getTokenTransfers('ethereum', 'usdt', ETH_ADDRESS, { limit: 5, fromTs: weekAgo })
  console.log('recent transfers:', transfers.length)

  if (transfers.length > 0) {
    const txHash = transfers[0].transactionHash
    const tx = await client.getTransactionTransfers('ethereum', 'usdt', txHash)
    console.log(`transfers in ${txHash}:`, tx.transfers.length)
  }
}

async function batches () {
  const requests = [
    { blockchain: 'ethereum', token: 'usdt', address: ETH_ADDRESS },
    { blockchain: 'tron', token: 'usdt', address: TRON_ADDRESS },
    { blockchain: 'tron', token: 'usdt', address: 'not-an-address' } // fails on its own
  ]

  const balances = await client.getBatchTokenBalances(requests)
  balances.forEach((item, i) => {
    if (isApiError(item)) console.log(`  balance[${i}] error:`, item.error, item.message || '')
    else console.log(`  balance[${i}]:`, item.tokenBalance.blockchain, item.tokenBalance.amount)
  })

  const transfers = await client.getBatchTokenTransfers(requests.map((r) => ({ ...r, limit: 3 })))
  transfers.forEach((item, i) => {
    if (isApiError(item)) console.log(`  transfers[${i}] error:`, item.error, item.message || '')
    else console.log(`  transfers[${i}]:`, item.transfers.length)
  })
}

async function walletReads () {
  const { wallets } = await client.listWallets()
  console.log('registered wallets:', wallets.length)

  if (wallets.length > 0) {
    const wallet = await client.getWallet(wallets[0].id)
    console.log('first wallet:', wallet.id, wallet.name, wallet.enabled)

    const { transfers } = await client.getWalletTransfers(wallet.id, { type: 'received', limit: 5 })
    console.log('its received transfers:', transfers.length)
  }

  const { transfers } = await client.getTransfers({ token: 'usdt', limit: 5, sort: 'desc' })
  console.log('transfers across all wallets:', transfers.length)
}

// Creates server state, so it only runs with --wallets.
async function walletLifecycle () {
  const { wallets } = await client.registerWallets([
    { type: 'client_wallet', name: 'usage example', addresses: { ethereum: ETH_ADDRESS } }
  ])
  const [result] = wallets
  if (result.status !== 201) {
    console.log('registration failed:', result.status, result.error)
    return
  }
  console.log('registered wallet:', result.id)

  try {
    const updated = await client.updateWallet(result.id, { name: 'usage example (paused)', enabled: false })
    console.log('updated:', updated.name, updated.enabled)
  } finally {
    const { success } = await client.deleteWallet(result.id)
    console.log('deleted:', success)
  }
}

async function main () {
  await publicEndpoints()

  if (!process.env.WDK_INDEXER_API_KEY) {
    console.log('Set WDK_INDEXER_API_KEY to run the authenticated examples.')
    return
  }

  await addressLookups()
  await batches()
  await walletReads()
  if (process.argv.includes('--wallets')) await walletLifecycle()
}

main().catch((err) => {
  if (err instanceof WdkIndexerValidationError) console.error('Invalid input:', err.message)
  else if (err instanceof WdkIndexerApiError) console.error(`API error ${err.status} (${err.errorType}):`, err.message)
  else if (err instanceof WdkIndexerTimeoutError) console.error(`Timed out after ${err.timeout}ms`)
  else if (err instanceof WdkIndexerNetworkError) console.error('Network error:', err.cause)
  else console.error(err)
  process.exitCode = 1
})
