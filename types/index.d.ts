// Copyright 2025 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** Supported blockchain networks */
export type Blockchain =
  | "ethereum"
  | "sepolia"
  | "plasma"
  | "arbitrum"
  | "polygon"
  | "tron"
  | "ton"
  | "bitcoin"
  | "spark";

/** Supported tokens */
export type Token = "usdt" | "xaut" | "btc";

/** Supported blockchain networks array */
export const BLOCKCHAINS: readonly Blockchain[];

/** Supported tokens array */
export const TOKENS: readonly Token[];

/** Health check response */
export interface HealthResponse {
  status: string;
  timestamp: string;
}

/** Token transfer record */
export interface TokenTransfer {
  /** The blockchain */
  blockchain: string;
  /** The block number in which the transaction was included */
  blockNumber: number;
  /** The transaction's hash */
  transactionHash: string;
  /** The index of the transfer within the transaction */
  transferIndex: number;
  /** The token */
  token: string;
  /** The amount of tokens transferred */
  amount: string;
  /** The timestamp when the transfer occurred */
  timestamp: number;
  /** The index of the transaction within the block */
  transactionIndex?: number | null;
  /** The index of the token transfer's event log in the transaction */
  logIndex?: number | null;
  /** The sender's address */
  from?: string | null;
  /** The recipient's address */
  to?: string | null;
  /** A label associated with the transfer, if any */
  label?: string;
  /** Additional properties */
  [key: string]: unknown;
}

/** Response for token transfers */
export interface TokenTransfersResponse {
  /** The token transfer history */
  transfers: TokenTransfer[];
}

/** Token balance record */
export interface TokenBalance {
  /** The blockchain */
  blockchain: string;
  /** The token */
  token: string;
  /** The amount of tokens */
  amount: string;
}

/** Response for token balance */
export interface TokenBalanceResponse {
  /** The token balance */
  tokenBalance: TokenBalance;
}

/** Error response from the API */
export interface ApiError {
  /** Error type or code */
  error: string;
  /** Detailed error message */
  message: string;
  /** HTTP status code */
  status: number;
}

/** Options for getting token transfers */
export interface GetTokenTransfersOptions {
  /** Maximum number of transfers to return (1-1000, default: 10) */
  limit?: number;
  /** Start timestamp filter (default: 0) */
  fromTs?: number;
  /** End timestamp filter */
  toTs?: number;
}

/** Request item for batch token transfers */
export interface BatchTokenTransfersRequest {
  blockchain: Blockchain;
  token: Token;
  address: string;
  /** Maximum number of transfers to return (1-1000, default: 10) */
  limit?: number;
  /** Start timestamp filter (default: 0) */
  fromTs?: number;
  /** End timestamp filter */
  toTs?: number;
}

/** Request item for batch token balances */
export interface BatchTokenBalancesRequest {
  blockchain: Blockchain;
  token: Token;
  address: string;
}

/** Response item for batch operations - can be success or error */
export type BatchTokenTransfersResponseItem = TokenTransfersResponse | ApiError;
export type BatchTokenBalancesResponseItem = TokenBalanceResponse | ApiError;

/** SDK configuration options */
export interface WdkIndexerConfig {
  /** API Key for authentication */
  apiKey: string;
  /** Base URL for the API (default: https://wdk-api.tether.io) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (for Node.js environments) */
  fetch?: typeof fetch;
}

/** Base error class for SDK errors */
export class WdkIndexerError extends Error {
  constructor(message: string);
}

/** Error thrown when the API returns an error response */
export class WdkIndexerApiError extends WdkIndexerError {
  readonly status: number;
  readonly errorType: string;
  constructor(apiError: ApiError);
}

/** Error thrown when a request times out */
export class WdkIndexerTimeoutError extends WdkIndexerError {
  constructor(timeout: number);
}

/** Error thrown when there's a network error */
export class WdkIndexerNetworkError extends WdkIndexerError {
  readonly cause?: Error;
  constructor(message: string, cause?: Error);
}

/** Check if a response is an API error */
export function isApiError(response: unknown): response is ApiError;

/** Check if a batch response item is a success (token transfers) */
export function isTokenTransfersResponse(
  item: BatchTokenTransfersResponseItem
): item is TokenTransfersResponse;

/** Check if a batch response item is a success (token balance) */
export function isTokenBalanceResponse(
  item: BatchTokenBalancesResponseItem
): item is TokenBalanceResponse;

/**
 * Tether WDK Indexer HTTP Client
 */
export class WdkIndexerClient {
  /** API Key for authentication */
  readonly apiKey: string;
  /** Base URL for the API */
  readonly baseUrl: string;
  /** Request timeout in milliseconds */
  readonly timeout: number;

  constructor(config: WdkIndexerConfig);

  /**
   * Health check endpoint
   * @returns Health status and timestamp
   */
  health(): Promise<HealthResponse>;

  /**
   * Get token transfers for an address
   * @param blockchain - The blockchain network
   * @param token - The token type
   * @param address - The wallet address
   * @param options - Optional filters (limit, fromTs, toTs)
   * @returns Token transfer history
   */
  getTokenTransfers(
    blockchain: Blockchain,
    token: Token,
    address: string,
    options?: GetTokenTransfersOptions
  ): Promise<TokenTransfersResponse>;

  /**
   * Get batch token transfers for multiple addresses
   * @param requests - Array of transfer requests
   * @returns Array of transfer responses (may contain errors for individual requests)
   */
  getBatchTokenTransfers(
    requests: BatchTokenTransfersRequest[]
  ): Promise<BatchTokenTransfersResponseItem[]>;

  /**
   * Get token balance for an address
   * @param blockchain - The blockchain network
   * @param token - The token type
   * @param address - The wallet address
   * @returns Current token balance
   */
  getTokenBalance(
    blockchain: Blockchain,
    token: Token,
    address: string
  ): Promise<TokenBalanceResponse>;

  /**
   * Get batch token balances for multiple addresses
   * @param requests - Array of balance requests
   * @returns Array of balance responses (may contain errors for individual requests)
   */
  getBatchTokenBalances(
    requests: BatchTokenBalancesRequest[]
  ): Promise<BatchTokenBalancesResponseItem[]>;
}

/**
 * Create a new WdkIndexerClient instance
 * @param config - Client configuration
 * @returns A new WdkIndexerClient instance
 */
export function createClient(config: WdkIndexerConfig): WdkIndexerClient;

export default WdkIndexerClient;
