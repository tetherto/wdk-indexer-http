# @tetherto/wdk-indexer-http

HTTP client for the Tether WDK Indexer API. Access blockchain token transfers and balances across multiple networks including Ethereum, Tron, Polygon, Arbitrum, TON, Bitcoin, and more.

> **Note:** This package is currently in beta. Test in a dev setup first.

## Getting an API Key

To use this SDK, you need an API key. Request one at: https://wdk-api.tether.io/register

## Installation

```bash
npm install @tetherto/wdk-indexer-http
```

## Quick Start

```javascript
import { WdkIndexerClient } from '@tetherto/wdk-indexer-http'

// Create a client instance
const client = new WdkIndexerClient({
  apiKey: 'your-api-key'
})

// Check API health
const health = await client.health()
console.log(health.status) // "ok"

// Get USDt balance on Ethereum
const balance = await client.getTokenBalance(
  'ethereum',
  'usdt',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f5aB12'
)
console.log(`Balance: ${balance.tokenBalance.amount} USDt`)

// Get token transfers
const transfers = await client.getTokenTransfers(
  'ethereum',
  'usdt',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f5aB12',
  { limit: 50 }
)
console.log(`Found ${transfers.transfers.length} transfers`)
```

## API

### Configuration

```javascript
const client = new WdkIndexerClient({
  apiKey: 'your-api-key',           // Required: API Key for authentication
  baseUrl: 'https://...',           // Optional: Custom API URL (default: https://wdk-api.tether.io)
  timeout: 30000,                   // Optional: Request timeout in ms (default: 30000)
  fetch: customFetch                // Optional: Custom fetch implementation
})
```

### Supported Blockchains

| Blockchain | Description |
|------------|-------------|
| `ethereum` | Ethereum Mainnet |
| `sepolia` | Ethereum Sepolia Testnet |
| `plasma` | Plasma Network |
| `arbitrum` | Arbitrum One |
| `polygon` | Polygon (Matic) |
| `tron` | TRON Network |
| `ton` | TON Network |
| `bitcoin` | Bitcoin Network |
| `spark` | Spark Network |

### Supported Tokens

| Token | Description |
|-------|-------------|
| `usdt` | Tether USD |
| `xaut` | Tether Gold |
| `btc` | Bitcoin |

### Methods

#### `health()`

Check if the API server is running.

```javascript
const health = await client.health()
// { status: "ok", timestamp: "2025-01-15T10:30:00.000Z" }
```

#### `getTokenTransfers(blockchain, token, address, options?)`

Get token transfer history for an address.

```javascript
const transfers = await client.getTokenTransfers(
  'ethereum',
  'usdt',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f5aB12',
  {
    limit: 100,         // Max 1000, default 10
    fromTs: 1700000000, // Start timestamp (optional)
    toTs: 1710000000    // End timestamp (optional)
  }
)

for (const transfer of transfers.transfers) {
  console.log(`${transfer.from} -> ${transfer.to}: ${transfer.amount}`)
}
```

#### `getTokenBalance(blockchain, token, address)`

Get current token balance for an address.

```javascript
const balance = await client.getTokenBalance(
  'tron',
  'usdt',
  'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'
)

console.log(`Balance: ${balance.tokenBalance.amount} ${balance.tokenBalance.token}`)
```

#### `getBatchTokenTransfers(requests)`

Get token transfers for multiple addresses in one call.

```javascript
import { isTokenTransfersResponse } from '@tetherto/wdk-indexer-http'

const results = await client.getBatchTokenTransfers([
  { blockchain: 'ethereum', token: 'usdt', address: '0x123...', limit: 50 },
  { blockchain: 'tron', token: 'usdt', address: 'T123...' },
  { blockchain: 'ton', token: 'usdt', address: 'EQ...' }
])

for (const result of results) {
  if (isTokenTransfersResponse(result)) {
    console.log(`Found ${result.transfers.length} transfers`)
  } else {
    console.error(`Error: ${result.message}`)
  }
}
```

#### `getBatchTokenBalances(requests)`

Get token balances for multiple addresses in one call.

```javascript
import { isTokenBalanceResponse } from '@tetherto/wdk-indexer-http'

const results = await client.getBatchTokenBalances([
  { blockchain: 'ethereum', token: 'usdt', address: '0x123...' },
  { blockchain: 'polygon', token: 'usdt', address: '0x456...' },
  { blockchain: 'arbitrum', token: 'usdt', address: '0x789...' }
])

for (const result of results) {
  if (isTokenBalanceResponse(result)) {
    const { blockchain, token, amount } = result.tokenBalance
    console.log(`${blockchain}: ${amount} ${token}`)
  } else {
    console.error(`Error: ${result.message}`)
  }
}
```

## Error Handling

The SDK provides typed errors for better error handling:

```javascript
import {
  WdkIndexerClient,
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError
} from '@tetherto/wdk-indexer-http'

try {
  const balance = await client.getTokenBalance('ethereum', 'usdt', '0x...')
} catch (error) {
  if (error instanceof WdkIndexerApiError) {
    // API returned an error response
    console.error(`API Error: ${error.message}`)
    console.error(`Status: ${error.status}`)
    console.error(`Error Type: ${error.errorType}`)
  } else if (error instanceof WdkIndexerTimeoutError) {
    // Request timed out
    console.error('Request timed out')
  } else if (error instanceof WdkIndexerNetworkError) {
    // Network error (connection failed, etc.)
    console.error(`Network error: ${error.message}`)
  } else if (error instanceof WdkIndexerError) {
    // Other SDK error
    console.error(`SDK error: ${error.message}`)
  }
}
```

## Bare Runtime

For use with bare runtime:

```javascript
import { WdkIndexerClient } from '@tetherto/wdk-indexer-http/bare'
```

## TypeScript

TypeScript type definitions are included. Import types as needed:

```typescript
import type {
  Blockchain,
  Token,
  TokenTransfer,
  TokenTransfersResponse,
  TokenBalance,
  TokenBalanceResponse,
  GetTokenTransfersOptions,
  BatchTokenTransfersRequest,
  BatchTokenBalancesRequest,
  ApiError,
  WdkIndexerConfig
} from '@tetherto/wdk-indexer-http'
```

### Convenience Constants

```javascript
import { BLOCKCHAINS, TOKENS } from '@tetherto/wdk-indexer-http'

console.log(BLOCKCHAINS)
// ['ethereum', 'sepolia', 'plasma', 'arbitrum', 'polygon', 'tron', 'ton', 'bitcoin', 'spark']

console.log(TOKENS)
// ['usdt', 'xaut', 'btc']
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run integration tests (requires API key)
WDK_INDEXER_API_KEY=your-api-key npm run test:integration

# Lint
npm run lint
```

## License

Apache-2.0
