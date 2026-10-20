# Changelog

This file lists all notable changes to `@tetherto/wdk-indexer-http`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

A rewrite against the WDK Indexer OpenAPI v1 spec. If you upgrade from 1.0.0-beta.1, read the breaking changes first.

### Added

- `getChains()` (`GET /chains`) returns the supported blockchains, their tokens and the address case-sensitivity rules. It needs no API key.
- `getTransactionTransfers(blockchain, token, txHash)` returns the transfers of one token inside one transaction.
- Wallet sync endpoints: `registerWallets()`, `listWallets()`, `getWallet()`, `updateWallet()`, `deleteWallet()`, `getWalletTransfers()` and `getTransfers()`. The transfer methods take the filters `blockchain`, `token`, `type`, `from`, `to`, `limit`, `skip` and `sort`.
- CommonJS and ESM from one file. `require()` and named `import` return the same classes, so `instanceof` works with both.
- Bare runtime support:
  - On Bare, the `#fetch`, `#abort-controller` and `#url` import maps select `bare-fetch`, `bare-abort-controller` and `bare-url`. On Node, they select the globals.
  - The three packages are optional peer dependencies. Install them on Bare with `npm install bare-fetch bare-abort-controller bare-url`. Node installs nothing extra.
- Hand-written TypeScript definitions (`index.d.ts`) for every request and response shape. `isApiError()` is a type guard. It is true for any item with a string `error`.
- Error details:
  - `WdkIndexerApiError` has `status` (the HTTP status), `errorType`, `message` and the parsed `body`.
  - `WdkIndexerTimeoutError` has `timeout`.
  - `WdkIndexerNetworkError` has `cause`.
  - An empty or non-JSON error body gives the message `HTTP <status> <statusText>`.
- Client-side checks and encoding:
  - The client checks one thing: authenticated methods need an API key. The server checks everything else.
  - The client encodes addresses with `encodeURIComponent()`. It puts the other path parameters into the URL as given, without encoding. See the README for the edge cases.
  - The client sends query options as given, but leaves out keys set to `undefined` or `null`.
  - The client builds the query string with `URLSearchParams`, so a space becomes `+`, not `%20`.
- Unit tests run on Node and on Bare (`npm test`, `npm run test:bare`). Optional live tests run with `npm run test:integration`.

### Breaking changes

- **The ESM default export is removed.** `import WdkIndexerClient from '@tetherto/wdk-indexer-http'` now gives you the exports object, not the class. Use the named import: `import { WdkIndexerClient } from '@tetherto/wdk-indexer-http'`. `require()` does not change.
- The default base URL is `https://wdk-api.tether.io`. Pass `baseUrl` to use another deployment.
- `plasma` is no longer a known blockchain. `avalanche` and the `usat` token are new.
- `fromTs` and `toTs` are in milliseconds, not seconds, in `getTokenTransfers()` and in batch transfer items. Multiply old values by 1000.
- `health()` returns a different body:
  - New: `{ status: 'healthy' | 'degraded' | 'unhealthy', timestamp, deployEnvironment, deployedVersion, summary, checks }`.
  - Old: `{ status: 'ok', timestamp }`.
  - The API returns 503 when the status is not `healthy`. `health()` resolves with the body on 200 and on 503. Other error statuses still reject.
- The constructor no longer throws without an `apiKey`. `health()` and `getChains()` work without a key and never send one. Every other method rejects with `WdkIndexerError('API key is required')` and sends no request.
- `createClient()` is removed. Use `new WdkIndexerClient(config)`.
- `isTokenTransfersResponse()` and `isTokenBalanceResponse()` are removed. Use `isApiError(item)` to find failed batch items.
- `BLOCKCHAINS` and `TOKENS` are removed. A hard-coded list goes out of date each time the server adds a chain. Call `getChains()` for the current list. The TypeScript types still suggest the known names.
- The client no longer rejects unknown chains or tokens. The server decides what it supports, and returns 400 for an unsupported pair.
- `WdkIndexerApiError.status` is always the HTTP status.
- `WdkIndexerNetworkError` takes the underlying error as its only argument.
- `apiKey`, `baseUrl`, `timeout` and `fetchFn` are no longer public properties of the client.
- The package no longer uses `bare-wdk-runtime`. The `./bare` subpath is an alias of the main entry. Node has no runtime dependencies. `bare-fetch`, `bare-abort-controller` and `bare-url` are optional peer dependencies, and only Bare needs them.
- The package requires Node.js 22 or later (it was 18).
- The package is no longer `"type": "module"`. The source is CommonJS, and ESM code imports it with named imports.

## [1.0.0-beta.1]

- Initial beta: `health()`, `getTokenTransfers()`, `getTokenBalance()`, `getBatchTokenTransfers()`, `getBatchTokenBalances()` and `createClient()`.
