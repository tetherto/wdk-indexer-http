// Types for @tetherto/wdk-indexer-http, derived from the WDK Indexer OpenAPI spec (v1).
// Response fields are typed as the server always sends them; the spec itself
// marks few of them as required.

// ---------------------------------------------------------------------------
// Chains and tokens
// ---------------------------------------------------------------------------

/** Blockchains known when this package was published; any other name is passed to the server. */
export type KnownBlockchain =
  | 'ethereum'
  | 'arbitrum'
  | 'avalanche'
  | 'polygon'
  | 'sepolia'
  | 'tron'
  | 'ton'
  | 'bitcoin'
  | 'spark'

/** Tokens known when this package was published; any other name is passed to the server. */
export type KnownToken = 'usdt' | 'xaut' | 'usat' | 'btc'

/** A blockchain name. Known names autocomplete; any other string is passed to the server. */
export type Blockchain = KnownBlockchain | (string & {})

/** A token name. Known names autocomplete; any other string is passed to the server. */
export type Token = KnownToken | (string & {})

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** The subset of a fetch Response the client reads. */
export interface FetchResponseLike {
  ok: boolean
  status: number
  statusText: string
  text (): Promise<string>
}

/** The subset of the fetch init the client sends. */
export interface FetchInitLike {
  method: string
  headers: Record<string, string>
  body?: string
  signal?: any
}

/** A fetch implementation (global fetch, bare-fetch, or a custom one). */
export type FetchLike = (url: string, init: FetchInitLike) => Promise<FetchResponseLike>

export interface WdkIndexerClientConfig {
  /** Sent as X-API-KEY. Required by every method except health() and getChains(). */
  apiKey?: string
  /** Defaults to https://wdk-api.tether.su. A trailing slash is stripped. */
  baseUrl?: string
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeout?: number
  /** Custom fetch. Defaults to the runtime fetch (bare-fetch on Bare). */
  fetch?: FetchLike
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Query options for getTokenTransfers(). */
export interface TokenTransferOptions {
  /** 1..1000, server default 10. */
  limit?: number
  /** Unix time in milliseconds (integer >= 0), inclusive, server default 0. */
  fromTs?: number
  /** Unix time in milliseconds (integer >= 0), inclusive. */
  toTs?: number
}

/** One item of getBatchTokenBalances(). */
export interface BatchTokenBalanceRequest {
  blockchain: Blockchain
  token: Token
  address: string
}

/** One item of getBatchTokenTransfers(). */
export interface BatchTokenTransferRequest extends BatchTokenBalanceRequest, TokenTransferOptions {}

export type TransferDirection = 'sent' | 'received'

export type SortOrder = 'asc' | 'desc'

/** Filters for getWalletTransfers() and getTransfers(). */
export interface TransferFilters {
  blockchain?: Blockchain
  token?: Token
  type?: TransferDirection
  /** Unix time in milliseconds (integer >= 0) or ISO 8601 date-time string. */
  from?: number | string
  /** Unix time in milliseconds (integer >= 0) or ISO 8601 date-time string. */
  to?: number | string
  /** 1..100, server default 10. */
  limit?: number
  /** Integer >= 0, server default 0. */
  skip?: number
  /** Server default 'desc'. */
  sort?: SortOrder
}

/** Spark-specific wallet metadata. */
export interface SparkWalletMeta {
  sparkDepositAddress: string
  sparkIdentityKey: string
}

export interface WalletMeta {
  spark?: SparkWalletMeta
}

/** Map of blockchain name to address (at least one entry). */
export type WalletAddresses = { [blockchain in KnownBlockchain]?: string } & Record<string, string>

/** One item of registerWallets(). */
export interface WalletRegistration {
  type: 'client_wallet'
  /** 1..100 characters. */
  name?: string
  addresses: WalletAddresses
  meta?: WalletMeta
}

/** Body of updateWallet(): at least one of name or enabled. */
export type WalletUpdate =
  | { name: string, enabled?: boolean }
  | { name?: string, enabled: boolean }

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export type CheckStatus = 'healthy' | 'unhealthy'

export interface DependencyCheck {
  status: CheckStatus
}

export interface IndexerCheck {
  status: CheckStatus
  rpcLatencyMs?: number
  lag?: number
  dependencies?: DependencyCheck
}

/** health() result. HTTP 200 when status is 'healthy', HTTP 503 when 'degraded' or 'unhealthy'. */
export interface HealthResponse {
  status: HealthStatus
  /** ISO 8601 date-time. */
  timestamp: string
  deployEnvironment?: string
  deployedVersion?: string
  summary?: {
    healthy: number
    unhealthy: number
    total: number
  }
  checks?: {
    dependencies?: DependencyCheck
    /** Keyed by '<blockchain>:<token>'. */
    indexers?: Record<string, IndexerCheck>
  }
}

export interface ChainCaseSensitivity {
  /** true, or a regex string for address formats that are case-sensitive. */
  address?: boolean | string
  tx?: boolean
  block?: boolean
}

export interface ChainInfo {
  name: Blockchain
  tokens: Token[]
  caseSensitive?: ChainCaseSensitivity
}

/** getChains() result. */
export interface ChainsResponse {
  chains: ChainInfo[]
}

/** A token transfer as returned by the token-transfer endpoints. */
export interface TokenTransfer {
  blockchain: Blockchain
  blockNumber: number
  transactionHash: string
  transferIndex: number
  token: Token
  /** Decimal string in the token's base units. */
  amount: string
  /** Block time, Unix time in milliseconds. */
  timestamp: number
  transactionIndex: number | null
  logIndex: number | null
  from: string | null
  to: string | null
  label?: string
  metadata?: Record<string, unknown> | null
  [key: string]: unknown
}

/** getTokenTransfers() and batch success item. */
export interface TokenTransfersResponse {
  transfers: TokenTransfer[]
}

/** getTransactionTransfers() result. */
export interface TransactionTransfersResponse {
  transfers: TokenTransfer[]
}

export interface TokenBalance {
  blockchain: Blockchain
  token: Token
  /** Decimal string in the token's base units. */
  amount: string
}

/** getTokenBalance() and batch success item. */
export interface TokenBalanceResponse {
  tokenBalance: TokenBalance
}

/** Error body from the API, also used for failed batch items. */
export interface ApiError {
  error: string
  message?: string
  status?: number
}

export type BatchTokenTransfersItem = TokenTransfersResponse | ApiError

export type BatchTokenBalancesItem = TokenBalanceResponse | ApiError

/** A registered wallet. */
export interface Wallet {
  id: string
  name?: string
  type: string
  enabled: boolean
  addresses: Record<string, string>
  meta?: WalletMeta
  /** Unix timestamp in milliseconds. */
  createdAt: number
  /** Unix timestamp in milliseconds. */
  updatedAt: number
}

/** Per-wallet outcome of registerWallets(). On failure `error` is set (and `limit`/`currentCount` when a quota is hit). */
export interface WalletRegistrationResult {
  status: number
  id?: string
  name?: string
  type?: string
  enabled?: boolean
  addresses?: Record<string, string>
  meta?: WalletMeta
  error?: string
  limit?: number
  currentCount?: number
}

/** registerWallets() result. */
export interface RegisterWalletsResponse {
  wallets: WalletRegistrationResult[]
}

/** listWallets() result. */
export interface ListWalletsResponse {
  wallets: Wallet[]
}

/** deleteWallet() result. */
export interface DeleteWalletResponse {
  success: boolean
}

/** A transfer involving a registered wallet. */
export interface WalletTransfer {
  walletId: string
  blockchain: Blockchain
  token: Token
  transactionHash: string
  transferIndex: number
  blockNumber: number
  /** Decimal string in the token's base units. */
  amount: string
  from: string | null
  to: string | null
  /** Block time, Unix time in milliseconds. */
  ts: number
  transactionIndex: number | null
  logIndex: number | null
  label?: string
  type: TransferDirection
}

/** getWalletTransfers() and getTransfers() result. */
export interface WalletTransfersResponse {
  transfers: WalletTransfer[]
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Base class for every error thrown by this package. */
export declare class WdkIndexerError extends Error {
  constructor (message?: string)
}

/** The API answered with a non-success status. */
export declare class WdkIndexerApiError extends WdkIndexerError {
  constructor (status: number, statusText: string, body: unknown)
  /** HTTP status code. */
  status: number
  /** body.error when it is a string, otherwise null. */
  errorType: string | null
  /** Parsed JSON body, raw text when not JSON, or null when empty. */
  body: unknown
}

/** The request did not complete within the configured timeout. */
export declare class WdkIndexerTimeoutError extends WdkIndexerError {
  constructor (timeout: number)
  /** Timeout in milliseconds. */
  timeout: number
}

/** The request failed before an HTTP response was received. */
export declare class WdkIndexerNetworkError extends WdkIndexerError {
  constructor (cause: unknown)
  /** The underlying error. */
  cause: unknown
}

/** Arguments failed client-side shape validation; no request was sent. */
export declare class WdkIndexerValidationError extends WdkIndexerError {}

/** True when a batch result item is an error entry (it has a string `error`). */
export declare function isApiError (item: unknown): item is ApiError

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum items per batch request and per registerWallets() call. */
export declare const BATCH_LIMIT: 10

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** HTTP client for the WDK Indexer API. */
export declare class WdkIndexerClient {
  constructor (config?: WdkIndexerClientConfig)

  /** GET /api/v1/health. No API key. Resolves with the JSON body on 200 and 503. */
  health (): Promise<HealthResponse>

  /** GET /api/v1/chains. No API key. */
  getChains (): Promise<ChainsResponse>

  /** GET /api/v1/{blockchain}/{token}/{address}/token-transfers. */
  getTokenTransfers (blockchain: Blockchain, token: Token, address: string, options?: TokenTransferOptions): Promise<TokenTransfersResponse>

  /** GET /api/v1/{blockchain}/{token}/{address}/token-balances. */
  getTokenBalance (blockchain: Blockchain, token: Token, address: string): Promise<TokenBalanceResponse>

  /** GET /api/v1/blockchains/{blockchain}/{token}/token-transfers/{txHash}. */
  getTransactionTransfers (blockchain: Blockchain, token: Token, txHash: string): Promise<TransactionTransfersResponse>

  /** POST /api/v1/batch/token-transfers with 1..10 requests. Items are in request order. */
  getBatchTokenTransfers (requests: BatchTokenTransferRequest[]): Promise<BatchTokenTransfersItem[]>

  /** POST /api/v1/batch/token-balances with 1..10 requests. Items are in request order. */
  getBatchTokenBalances (requests: BatchTokenBalanceRequest[]): Promise<BatchTokenBalancesItem[]>

  /** POST /api/v1/wallets with 1..10 wallets. */
  registerWallets (wallets: WalletRegistration[]): Promise<RegisterWalletsResponse>

  /** GET /api/v1/wallets. */
  listWallets (): Promise<ListWalletsResponse>

  /** GET /api/v1/wallets/{walletId}. */
  getWallet (walletId: string): Promise<Wallet>

  /** PATCH /api/v1/wallets/{walletId}. */
  updateWallet (walletId: string, patch: WalletUpdate): Promise<Wallet>

  /** DELETE /api/v1/wallets/{walletId}. */
  deleteWallet (walletId: string): Promise<DeleteWalletResponse>

  /** GET /api/v1/wallets/{walletId}/transfers. */
  getWalletTransfers (walletId: string, filters?: TransferFilters): Promise<WalletTransfersResponse>

  /** GET /api/v1/transfers across all wallets. */
  getTransfers (filters?: TransferFilters): Promise<WalletTransfersResponse>
}
