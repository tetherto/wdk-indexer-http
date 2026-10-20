# @tetherto/wdk-indexer-http

HTTP client for the Indexer API from WDK (Wallet Development Kit) by Tether. Access blockchain token transfers and balances across multiple networks including Ethereum, Tron, Polygon, Arbitrum, TON, Bitcoin, and more.

- Works on Node.js (>= 22) and the [Bare](https://github.com/holepunchto/bare) runtime (>= 1.27)
- CommonJS and ESM from one implementation
- No runtime dependencies on Node. Bare needs `bare-fetch`, `bare-abort-controller` and `bare-url` (optional peer dependencies)
- Typed errors and bundled TypeScript definitions

See the [Indexer API documentation](https://docs.wdk.tether.io/tools/indexer-api/).

## Getting an API Key

Every endpoint except `health()` and `getChains()` needs an API key. Request one at https://wdk-api.tether.io/register

## Installation

```bash
npm install @tetherto/wdk-indexer-http
```

On Bare, also install the optional peer dependencies:

```bash
npm install bare-fetch bare-abort-controller bare-url
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

Use the same import on Bare. The package's import maps select `bare-fetch`, `bare-abort-controller` and `bare-url` on Bare and the globals on Node. You only need to install the three packages (see [Installation](#installation)).

The client needs Bare 1.27.0 or later. The dependencies of `bare-fetch` set this minimum. An older Bare refuses to load them with an `UNSUPPORTED_ENGINE` error.

```javascript
const { WdkIndexerClient } = require('@tetherto/wdk-indexer-http')
```

The `@tetherto/wdk-indexer-http/bare` subpath is an alias of the main entry. It stays for compatibility with 1.0.0-beta.1.

## Configuration

```javascript
const client = new WdkIndexerClient({
  apiKey: 'your-api-key',               // optional. Required by every method except health() and getChains()
  baseUrl: 'https://wdk-api.tether.io', // optional. This is the default. Trailing slashes are removed
  timeout: 30000,                       // optional. Per-request timeout in ms (default 30000)
  fetch: customFetch                    // optional. Replaces the built-in fetch
})
```

- The client sends `apiKey` in the `X-API-KEY` header. Without a key, authenticated methods reject with `WdkIndexerError('API key is required')` and send no request. `health()` and `getChains()` never send the key.
- `fetch` is any WHATWG-compatible `fetch(url, init)`. Use it to add logging, retries or a proxy, or to mock the API in tests.
- Every request sends `Accept: application/json`. Requests with a body also send `Content-Type: application/json`.
- `timeout` rejects with `WdkIndexerTimeoutError` and aborts the request, on Node and on Bare.

## Methods

Every method returns a promise. The promise resolves with the parsed JSON body, exactly as the API returns it. All paths are under `/api/v1`.

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

Deep health check of the API and its indexers. The API returns HTTP 200 when the status is `healthy`, and HTTP 503 when it is `degraded` or `unhealthy`. The client resolves with the body in both cases, so check `status` instead of catching an error.

The client rejects any other error status. It also rejects a 503 without a JSON body, for example an HTML page from a proxy.

```javascript
const health = await client.health()
// { status: 'healthy' | 'degraded' | 'unhealthy', timestamp, deployEnvironment,
//   deployedVersion, summary: { healthy, unhealthy, total }, checks: { dependencies, indexers } }
if (health.status !== 'healthy') console.warn('indexer is', health.status)
```

### `getChains()`

Lists the blockchains the server supports, the tokens on each blockchain, and the address case-sensitivity rules. Use it to find the valid blockchain and token pairs.

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

Transfers of one token inside one transaction. `txHash` can have up to 255 characters. If the transaction does not exist, or moved none of that token, the API returns 404 and the client throws `WdkIndexerApiError`.

```javascript
const { transfers } = await client.getTransactionTransfers('ethereum', 'usdt', '0xabc...')
```

### `getBatchTokenTransfers(requests)`

Transfer history for up to 10 addresses in one request. Each item takes `{ blockchain, token, address, limit?, fromTs?, toTs? }`.

The server handles each item independently. The result array keeps the request order. A failed item comes back as an error object (`{ error, message?, status? }`). Check each item with `isApiError()`, which is true for any item with a string `error`.

The package exports `BATCH_LIMIT` (`10`). Use it to split a long address list into batches.

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

Balances for up to 10 addresses in one request. Each item takes `{ blockchain, token, address }`. Each failed item comes back as an error object, as in `getBatchTokenTransfers()`.

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

Registers 1 to 10 wallets. The server then syncs the transfers of their addresses.

- Each wallet needs `type: 'client_wallet'` and an `addresses` object keyed by blockchain.
- `name` and `meta` are optional. A `spark` address requires `meta.spark`.
- Each wallet gets its own result `status`: 201 created, 400 invalid, or 429 wallet limit reached.

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

Renames a wallet, or turns its syncing on or off. The patch must contain `name` (1 to 100 characters), `enabled` (boolean), or both, and no other keys. Resolves with the updated wallet.

```javascript
await client.updateWallet(walletId, { name: 'Cold storage', enabled: false })
```

### `deleteWallet(walletId)`

Deletes the wallet and stops its syncing. You can register its addresses again later.

```javascript
const { success } = await client.deleteWallet(walletId)
```

### `getWalletTransfers(walletId, filters?)` and `getTransfers(filters?)`

Synced transfers for one registered wallet, or for all your wallets. Both methods take the same optional filters:

| Filter | Type |
| --- | --- |
| `blockchain`, `token` | a blockchain or token name, e.g. `'ethereum'`, `'usdt'` |
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

The client leaves options set to `undefined` or `null` out of the query string. The server ignores keys it does not know.

## Validation

The client checks one thing: authenticated methods need an `apiKey`. Without it, the method rejects with `WdkIndexerError` and sends no request.

The server checks everything else, and rejects a bad value with HTTP 400. The method then rejects with a `WdkIndexerApiError` whose message names the field. The client does not check blockchain or token names, so a chain that the server adds later works without an upgrade. Call `getChains()` for the current list.

### Path parameters

The client encodes `address` with `encodeURIComponent()`. A TON address in standard base64 (`EQCx…Id/sDs`) contains `/` and `+`, and works only when encoded.

The client puts `blockchain`, `token`, `txHash` and `walletId` into the URL as given, without encoding. All formats that the API documents for these values are URL-safe.

In an unencoded value, these characters change the request URL:

- `/` splits the value into two path segments.
- `?` and `#` end the path. The request can go to a different endpoint.
- `%` starts an escape sequence.
- `fetch` drops a full value of `.` or `..` from the path. For `..`, it also drops the segment before it.

If one of these values can contain such characters, encode it with `encodeURIComponent()` before you call the client.

## Error handling

All errors extend `WdkIndexerError`. `instanceof` works the same with `require` and with `import`.

| Class | When | Extra fields |
| --- | --- | --- |
| `WdkIndexerApiError` | The API returned an error status | `status`, `errorType` (`body.error`), `body` |
| `WdkIndexerTimeoutError` | No response within `timeout` ms | `timeout` |
| `WdkIndexerNetworkError` | `fetch` failed, or the client could not read the body | `cause` |
| `WdkIndexerError` | Base class. The client also throws it when an authenticated method has no API key, or when a 2xx body is not valid JSON | none |

For `WdkIndexerApiError`, `message` is the server's `message`. If the error body is empty or not JSON, the message is `HTTP <status> <statusText>`, and `body` holds the raw text or `null`.

```javascript
const {
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError
} = require('@tetherto/wdk-indexer-http')

try {
  await client.getTokenBalance('ethereum', 'usdt', address)
} catch (err) {
  if (err instanceof WdkIndexerApiError) {
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

The package includes type definitions in `index.d.ts`. They work with `moduleResolution` `node16`/`nodenext`, `bundler` and `node10`.

The types cover the client, the config, the options, the request items, `ApiError` and the error classes. They also cover the response bodies: `HealthResponse`, `ChainsResponse`, `TokenTransfersResponse`, `TokenBalanceResponse`, `Wallet`, `WalletTransfersResponse` and others.

- `isApiError()` is a type guard. It narrows the item types of batch results.
- The `Blockchain` and `Token` types suggest the known names, but accept any string.

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
| `WDK_INDEXER_API_KEY` | For authenticated tests | API key for the `X-API-KEY` header. Without it, only the `health()` and `getChains()` tests run. The tests skip the rest. |
| `WDK_INDEXER_WALLET_TESTS` | No | Set to `1` to also run the wallet lifecycle test. It registers, updates and then deletes a wallet on your account. |
| `WDK_INDEXER_BASE_URL` | No | Target another deployment instead of `https://wdk-api.tether.io`. |

The tests do not read a `.env` file. To use one, export it into the shell first:

```bash
set -a && . ./.env && set +a && npm run test:integration
```

`examples/usage.js` calls every read method:

```bash
WDK_INDEXER_API_KEY=your-key node examples/usage.js
WDK_INDEXER_API_KEY=your-key node examples/usage.js --wallets   # also registers, updates and deletes a wallet
```

See [CHANGELOG.md](CHANGELOG.md) for release notes and breaking changes.

## License

Apache-2.0
