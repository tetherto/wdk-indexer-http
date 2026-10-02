# @tetherto/wdk-indexer-http

HTTP client for the Tether WDK Indexer API. Query token transfers and balances, look up the transfers of a single transaction, and register wallets so their transfers are synced for you. Supported networks include Ethereum, Arbitrum, Avalanche, Polygon, Tron, TON, Bitcoin and Spark.

- Works on Node.js (>= 22) and the [Bare](https://github.com/holepunchto/bare) runtime
- CommonJS and ESM from a single implementation
- One runtime dependency (`bare-fetch`, used only on Bare)
- Typed errors and bundled TypeScript definitions

## Getting an API key

Every endpoint except `health()` and `getChains()` needs an API key. Request one at https://wdk-api.tether.io/register

## Installation

```bash
npm install @tetherto/wdk-indexer-http
```

## Quick start

ESM:

```javascript
import { WdkIndexerClient } from '@tetherto/wdk-indexer-http'

const client = new WdkIndexerClient({ apiKey: process.env.WDK_INDEXER_API_KEY })

const { tokenBalance } = await client.getTokenBalance(
  'ethereum',
  'usdt',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f5aB12'
)
console.log(`${tokenBalance.amount} ${tokenBalance.token}`)
```

CommonJS:

```javascript
const { WdkIndexerClient } = require('@tetherto/wdk-indexer-http')

const client = new WdkIndexerClient({ apiKey: process.env.WDK_INDEXER_API_KEY })

client.getTokenTransfers('tron', 'usdt', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', { limit: 20 })
  .then(({ transfers }) => console.log(`${transfers.length} transfers`))
```

## Bare runtime

Use the same import on Bare. The package's `#fetch` import map picks `bare-fetch` on Bare and the global `fetch` on Node, so you don't need to configure anything:

```javascript
const { WdkIndexerClient } = require('@tetherto/wdk-indexer-http')
```

The `@tetherto/wdk-indexer-http/bare` subpath is still published for compatibility with 1.0.0-beta.1. It is now an alias of the main entry.

## Configuration

```javascript
const client = new WdkIndexerClient({
  apiKey: 'your-api-key',               // optional; required by every method except health() and getChains()
  baseUrl: 'https://wdk-api.tether.su', // optional; the default. A trailing slash is removed
  timeout: 30000,                       // optional; per-request timeout in ms (default 30000)
  fetch: customFetch                    // optional; replaces the built-in fetch
})
```

- `apiKey` is sent as the `X-API-KEY` header. If it is missing, authenticated methods reject with `WdkIndexerValidationError('API key is required')` without making a request. `health()` and `getChains()` never send the key.
- `fetch` is any WHATWG-compatible `fetch(url, init)`. Use it to add logging, retries or a proxy, or to mock the API in tests.
- Requests always send `Accept: application/json`. `Content-Type: application/json` is sent only when there is a body.
- `timeout` rejects with `WdkIndexerTimeoutError`. When the runtime has `AbortController` (Node), the request is aborted as well. Bare has no `AbortController`, so there the timeout only stops waiting and the socket stays open until the server answers. To cancel requests on Bare, set `globalThis.AbortController` first (for example from `bare-abort-controller`); `bare-fetch` honours the signal.

## Methods

Every method returns a promise that resolves with the parsed JSON body exactly as the API returns it. All paths are under `/api/v1`.

| Method | Endpoint | Key |
| --- | --- | --- |
| `health()` | `GET /health` | no |
| `getChains()` | `GET /chains` | no |
| `getTokenTransfers(blockchain, token, address, options?)` | `GET /{blockchain}/{token}/{address}/token-transfers` | yes |
| `getTokenBalance(blockchain, token, address)` | `GET /{blockchain}/{token}/{address}/token-balances` | yes |
| `getTransactionTransfers(blockchain, token, txHash)` | `GET /blockchains/{blockchain}/{token}/token-transfers/{txHash}` | yes |
| `getBatchTokenTransfers(requests)` | `POST /batch/token-transfers` | yes |
| `getBatchTokenBalances(requests)` | `POST /batch/token-balances` | yes |
| `registerWallets(wallets)` | `POST /wallets` | yes |
| `listWallets()` | `GET /wallets` | yes |
| `getWallet(walletId)` | `GET /wallets/{walletId}` | yes |
| `updateWallet(walletId, patch)` | `PATCH /wallets/{walletId}` | yes |
| `deleteWallet(walletId)` | `DELETE /wallets/{walletId}` | yes |
| `getWalletTransfers(walletId, filters?)` | `GET /wallets/{walletId}/transfers` | yes |
| `getTransfers(filters?)` | `GET /transfers` | yes |

### `health()`

Deep health check of the API and its indexers. The API answers HTTP 200 when the overall status is `healthy` and HTTP 503 when it is `degraded` or `unhealthy`. The client resolves with the body in both cases, so check `status` instead of catching. Any other error status rejects, and so does a 503 without a JSON body (for example an HTML page from a proxy).

```javascript
const health = await client.health()
// { status: 'healthy' | 'degraded' | 'unhealthy', timestamp, deployEnvironment,
//   deployedVersion, summary: { healthy, unhealthy, total }, checks: { dependencies, indexers } }
if (health.status !== 'healthy') console.warn('indexer is', health.status)
```

### `getChains()`

Lists the blockchains the server supports, the tokens available on each, and address case-sensitivity rules. Use it to find out which blockchain and token pairs are valid.

```javascript
const { chains } = await client.getChains()
// [{ name: 'ethereum', tokens: ['usdt', 'xaut', 'usat'] },
//  { name: 'tron', tokens: ['usdt'], caseSensitive: { address: true } }, ...]
```

### `getTokenTransfers(blockchain, token, address, options?)`

Transfer history of one address. Options:

- `limit`: integer from 1 to 1000 (the server default is 10)
- `fromTs`: start time in milliseconds, inclusive
- `toTs`: end time in milliseconds, inclusive

```javascript
const { transfers } = await client.getTokenTransfers(
  'ethereum',
  'usdt',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f5aB12',
  { limit: 100, fromTs: Date.now() - 7 * 24 * 60 * 60 * 1000 }
)
for (const t of transfers) console.log(t.transactionHash, t.from, '->', t.to, t.amount)
```

### `getTokenBalance(blockchain, token, address)`

Current balance of one address.

```javascript
const { tokenBalance } = await client.getTokenBalance('tron', 'usdt', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
// { blockchain: 'tron', token: 'usdt', amount: '...' }
```

### `getTransactionTransfers(blockchain, token, txHash)`

Transfers of one token inside one transaction. `txHash` can be up to 255 characters. If the transaction moved none of that token, or doesn't exist, the API returns 404 and the client throws `WdkIndexerApiError`.

```javascript
const { transfers } = await client.getTransactionTransfers('ethereum', 'usdt', '0xabc...')
```

### `getBatchTokenTransfers(requests)`

Transfer history for up to 10 addresses (`BATCH_LIMIT`) in one request. Each item takes `{ blockchain, token, address, limit?, fromTs?, toTs? }`. Items are processed independently, and the result array keeps the request order. A failed item comes back as an error object (`{ error, message?, status? }`) instead of a result, so check each one with `isApiError()`, which is true for any item with a string `error`.

```javascript
const { isApiError } = require('@tetherto/wdk-indexer-http')

const results = await client.getBatchTokenTransfers([
  { blockchain: 'ethereum', token: 'usdt', address: '0x742d...', limit: 50 },
  { blockchain: 'tron', token: 'usdt', address: 'TR7N...' }
])
for (const item of results) {
  if (isApiError(item)) console.error(item.error, item.message)
  else console.log(item.transfers.length, 'transfers')
}
```

### `getBatchTokenBalances(requests)`

Balances for up to 10 addresses in one request. Each item takes `{ blockchain, token, address }`. Failed items are reported per item, as in `getBatchTokenTransfers()`.

```javascript
const results = await client.getBatchTokenBalances([
  { blockchain: 'ethereum', token: 'usdt', address: '0x742d...' },
  { blockchain: 'polygon', token: 'usdt', address: '0x742d...' }
])
for (const item of results) {
  if (!isApiError(item)) console.log(item.tokenBalance.blockchain, item.tokenBalance.amount)
}
```

### `registerWallets(wallets)`

Registers 1 to 10 wallets. The server then keeps syncing transfers for their addresses. Each wallet needs `type: 'client_wallet'` and an `addresses` object keyed by blockchain. `name` and `meta` are optional, except that registering a `spark` address requires `meta.spark`. Each wallet gets its own result `status`: 201 created, 400 invalid, or 429 wallet limit reached.

```javascript
const { wallets } = await client.registerWallets([
  {
    type: 'client_wallet',
    name: 'Treasury',
    addresses: { ethereum: '0x742d...', tron: 'TR7N...' }
  }
])
const created = wallets.filter((w) => w.status === 201)
```

### `listWallets()` and `getWallet(walletId)`

```javascript
const { wallets } = await client.listWallets()
const wallet = await client.getWallet(wallets[0].id)
// { id, name, type, enabled, addresses, meta, createdAt, updatedAt }
```

### `updateWallet(walletId, patch)`

Renames a wallet or turns its syncing on or off. The patch must contain `name` (1 to 100 characters), `enabled` (boolean), or both, and no other keys. Resolves with the updated wallet.

```javascript
await client.updateWallet(walletId, { name: 'Cold storage', enabled: false })
```

### `deleteWallet(walletId)`

Deletes the wallet and stops syncing it. Its addresses can be registered again later.

```javascript
const { success } = await client.deleteWallet(walletId)
```

### `getWalletTransfers(walletId, filters?)` and `getTransfers(filters?)`

Synced transfers for one registered wallet, or for all your wallets. Both methods take the same optional filters:

| Filter | Type |
| --- | --- |
| `blockchain`, `token` | non-empty string |
| `type` | `'sent'` or `'received'` |
| `from`, `to` | time in ms (integer >= 0) or an ISO 8601 string |
| `limit` | integer from 1 to 100 (the server default is 10) |
| `skip` | integer >= 0, the pagination offset |
| `sort` | `'asc'` or `'desc'` (the server default is `'desc'`) |

```javascript
const { transfers } = await client.getWalletTransfers(walletId, {
  token: 'usdt',
  type: 'received',
  from: '2026-01-01T00:00:00Z',
  limit: 50,
  sort: 'asc'
})

const everything = await client.getTransfers({ blockchain: 'tron', skip: 50, limit: 50 })
```

Options that are `undefined` are left out of the query string, and keys that aren't documented are ignored.

## Validation

The client checks only what the server can't check for it:

- `blockchain`, `token`, `address`, `txHash` and `walletId` must be non-empty strings other than `'.'` and `'..'`. They are URL path segments, and fetch would resolve those values to a different endpoint.
- Authenticated methods need an `apiKey`.

A failed check rejects with `WdkIndexerValidationError` (for example `walletId must be a non-empty string`), and no request is sent.

Everything else goes to the server as given: option values, enum values, wallet fields, and batch arrays and their items (the server takes 1 to 10). The server rejects invalid values with an HTTP 400 `WdkIndexerApiError` whose message names the field. Blockchain and token names aren't checked against a list either. The server decides what it supports, so a chain it adds tomorrow works without upgrading this package. Call `getChains()` to see what's supported today.

`BATCH_LIMIT` is the server's batch size limit (`10`), exported so you can split a long address list into batches.

## Error handling

All errors extend `WdkIndexerError`, and `instanceof` works the same whether you load the package with `require` or `import`.

| Class | When | Extra fields |
| --- | --- | --- |
| `WdkIndexerValidationError` | Invalid arguments, or no API key for an authenticated method | none |
| `WdkIndexerApiError` | The API answered with an error status | `status`, `errorType` (`body.error`), `body` |
| `WdkIndexerTimeoutError` | No response within `timeout` ms | `timeout` |
| `WdkIndexerNetworkError` | `fetch` failed, or the body couldn't be read | `cause` |
| `WdkIndexerError` | Base class. Also thrown directly when a 2xx response isn't valid JSON | none |

For `WdkIndexerApiError`, `message` is the server's `message`. If the error body is empty or isn't JSON, the message is `HTTP <status> <statusText>`, and `body` holds the raw text or `null`.

```javascript
const {
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError
} = require('@tetherto/wdk-indexer-http')

try {
  await client.getTokenBalance('ethereum', 'usdt', address)
} catch (err) {
  if (err instanceof WdkIndexerValidationError) {
    console.error('bad input:', err.message)
  } else if (err instanceof WdkIndexerApiError) {
    // 400 invalid params, 401 expired key, 403 missing or invalid key, 404, 429 rate limited, 5xx
    console.error(err.status, err.errorType, err.message)
  } else if (err instanceof WdkIndexerTimeoutError) {
    console.error(`timed out after ${err.timeout}ms`)
  } else if (err instanceof WdkIndexerNetworkError) {
    console.error('network failure:', err.cause)
  } else {
    throw err
  }
}
```

## TypeScript

Type definitions ship in `index.d.ts` and resolve correctly under `moduleResolution` `node16`/`nodenext`, `bundler` and `node10`. They include the client, config, options, request items, response bodies (`HealthResponse`, `ChainsResponse`, `TokenTransfersResponse`, `TokenBalanceResponse`, `Wallet`, `WalletTransfersResponse` and others), `ApiError`, and the error classes. `isApiError()` is a type guard, so it narrows the item types of batch results. The `Blockchain` and `Token` types suggest the known names but accept any string.

```typescript
import { WdkIndexerClient, isApiError, type TokenBalanceResponse } from '@tetherto/wdk-indexer-http'
```

## Development

```bash
npm install

npm run lint        # standard
npm test            # unit tests on Node (brittle)
npm run test:bare   # the same unit tests on Bare (npm i -g bare)
npm run test:types  # type-checks test/types with TypeScript 5 (fetched by npx)

# Live integration tests against the API
npm run test:integration                                           # health and chains only
WDK_INDEXER_API_KEY=your-key npm run test:integration              # plus authenticated reads
WDK_INDEXER_API_KEY=your-key WDK_INDEXER_WALLET_TESTS=1 \
  npm run test:integration                                         # plus wallet register/update/delete
WDK_INDEXER_BASE_URL=https://... npm run test:integration          # target another deployment
npm run test:integration:bare                                      # the same live tests on Bare
```

The integration tests read these environment variables:

| Variable | Required | Description |
|---|---|---|
| `WDK_INDEXER_API_KEY` | For authenticated tests | API key sent as `X-API-KEY`. Without it, only `health()` and `getChains()` run and the rest are skipped. |
| `WDK_INDEXER_WALLET_TESTS` | No | Set to `1` to also run the wallet lifecycle test. It registers, updates and deletes a wallet on your account, and cleans up after itself. |
| `WDK_INDEXER_BASE_URL` | No | Target another deployment instead of `https://wdk-api.tether.su`. |

The tests don't load a `.env` file themselves. To keep the values in one, export it into the shell first:

```bash
set -a && . ./.env && set +a && npm run test:integration
```

`examples/usage.js` runs through every read method:

```bash
WDK_INDEXER_API_KEY=your-key node examples/usage.js
WDK_INDEXER_API_KEY=your-key node examples/usage.js --wallets   # also registers, updates and deletes a wallet
```

See [CHANGELOG.md](CHANGELOG.md) for release notes and breaking changes.

## License

Apache-2.0
