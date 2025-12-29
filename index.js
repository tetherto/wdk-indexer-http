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
'use strict'

/**
 * Tether WDK Indexer HTTP Client
 *
 * A client for interacting with the Tether WDK Indexer API.
 * Provides access to blockchain token transfers and balances across multiple networks.
 */

/** Supported blockchain networks */
export const BLOCKCHAINS = [
  'ethereum',
  'sepolia',
  'plasma',
  'arbitrum',
  'polygon',
  'tron',
  'ton',
  'bitcoin',
  'spark'
]

/** Supported tokens */
export const TOKENS = ['usdt', 'xaut', 'btc']

/**
 * Base error class for SDK errors
 */
export class WdkIndexerError extends Error {
  constructor (message) {
    super(message)
    this.name = 'WdkIndexerError'
  }
}

/**
 * Error thrown when the API returns an error response
 */
export class WdkIndexerApiError extends WdkIndexerError {
  constructor (apiError) {
    super(apiError.message)
    this.name = 'WdkIndexerApiError'
    this.status = apiError.status
    this.errorType = apiError.error
  }
}

/**
 * Error thrown when a request times out
 */
export class WdkIndexerTimeoutError extends WdkIndexerError {
  constructor (timeout) {
    super(`Request timed out after ${timeout}ms`)
    this.name = 'WdkIndexerTimeoutError'
  }
}

/**
 * Error thrown when there's a network error
 */
export class WdkIndexerNetworkError extends WdkIndexerError {
  constructor (message, cause) {
    super(message)
    this.name = 'WdkIndexerNetworkError'
    this.cause = cause
  }
}

/**
 * Check if a response is an API error
 * @param {unknown} response
 * @returns {boolean}
 */
export function isApiError (response) {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    'message' in response &&
    'status' in response
  )
}

/**
 * Check if a batch response item is a success (token transfers)
 * @param {object} item
 * @returns {boolean}
 */
export function isTokenTransfersResponse (item) {
  return 'transfers' in item
}

/**
 * Check if a batch response item is a success (token balance)
 * @param {object} item
 * @returns {boolean}
 */
export function isTokenBalanceResponse (item) {
  return 'tokenBalance' in item
}

/**
 * Tether WDK Indexer HTTP Client
 *
 * @example
 * ```javascript
 * const client = new WdkIndexerClient({ apiKey: 'your-api-key' });
 *
 * // Check API health
 * const health = await client.health();
 *
 * // Get token transfers
 * const transfers = await client.getTokenTransfers('ethereum', 'usdt', '0x...');
 *
 * // Get token balance
 * const balance = await client.getTokenBalance('ethereum', 'usdt', '0x...');
 * ```
 */
export class WdkIndexerClient {
  /**
   * Create a new WdkIndexerClient instance
   * @param {object} config - Client configuration
   * @param {string} config.apiKey - API Key for authentication
   * @param {string} [config.baseUrl='https://wdk-api.tether.io'] - Base URL for the API
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation
   */
  constructor (config) {
    if (!config.apiKey) {
      throw new WdkIndexerError('API key is required')
    }

    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl || 'https://wdk-api.tether.io').replace(
      /\/$/,
      ''
    )
    this.timeout = config.timeout || 30000
    this.fetchFn = config.fetch || globalThis.fetch

    if (!this.fetchFn) {
      throw new WdkIndexerError(
        'fetch is not available. Please provide a custom fetch implementation or use Node.js 18+.'
      )
    }
  }

  /**
   * Make an HTTP request to the API
   * @private
   * @param {'GET' | 'POST'} method
   * @param {string} path
   * @param {object} [options]
   * @param {Record<string, string | number | undefined>} [options.query]
   * @param {unknown} [options.body]
   * @returns {Promise<unknown>}
   */
  async _request (method, path, options) {
    let url = `${this.baseUrl}${path}`

    // Add query parameters
    if (options?.query) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          params.append(key, String(value))
        }
      }
      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      })

      const data = await response.json()

      if (!response.ok) {
        if (isApiError(data)) {
          throw new WdkIndexerApiError(data)
        }
        throw new WdkIndexerApiError({
          error: 'UnknownError',
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        })
      }

      return data
    } catch (error) {
      if (error instanceof WdkIndexerError) {
        throw error
      }
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new WdkIndexerTimeoutError(this.timeout)
        }
        throw new WdkIndexerNetworkError(error.message, error)
      }
      throw new WdkIndexerNetworkError('An unknown error occurred')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Health check endpoint
   *
   * Check if the API server is running.
   *
   * @returns {Promise<{status: string, timestamp: string}>} Health status and timestamp
   *
   * @example
   * ```javascript
   * const health = await client.health();
   * console.log(health.status); // "ok"
   * ```
   */
  async health () {
    return this._request('GET', '/api/v1/health')
  }

  /**
   * Get token transfers for an address
   *
   * Retrieve the token transfer history for a specific address on a given blockchain.
   *
   * @param {string} blockchain - The blockchain network
   * @param {string} token - The token type
   * @param {string} address - The wallet address
   * @param {object} [options] - Optional filters
   * @param {number} [options.limit] - Maximum number of transfers to return (1-1000, default: 10)
   * @param {number} [options.fromTs] - Start timestamp filter (default: 0)
   * @param {number} [options.toTs] - End timestamp filter
   * @returns {Promise<{transfers: Array<object>}>} Token transfer history
   *
   * @example
   * ```javascript
   * // Get the last 100 USDt transfers on Ethereum
   * const transfers = await client.getTokenTransfers(
   *   'ethereum',
   *   'usdt',
   *   '0x1234...',
   *   { limit: 100 }
   * );
   * ```
   */
  async getTokenTransfers (blockchain, token, address, options) {
    return this._request(
      'GET',
      `/api/v1/${blockchain}/${token}/${encodeURIComponent(
        address
      )}/token-transfers`,
      {
        query: {
          limit: options?.limit,
          fromTs: options?.fromTs,
          toTs: options?.toTs
        }
      }
    )
  }

  /**
   * Get batch token transfers for multiple addresses
   *
   * Retrieve the token transfer history for multiple addresses on blockchains.
   *
   * @param {Array<{blockchain: string, token: string, address: string, limit?: number, fromTs?: number, toTs?: number}>} requests - Array of transfer requests
   * @returns {Promise<Array<object>>} Array of transfer responses (may contain errors for individual requests)
   *
   * @example
   * ```javascript
   * const results = await client.getBatchTokenTransfers([
   *   { blockchain: 'ethereum', token: 'usdt', address: '0x1234...', limit: 50 },
   *   { blockchain: 'tron', token: 'usdt', address: 'T1234...' },
   * ]);
   * ```
   */
  async getBatchTokenTransfers (requests) {
    return this._request('POST', '/api/v1/batch/token-transfers', {
      body: requests
    })
  }

  /**
   * Get token balance for an address
   *
   * Retrieve the current token balance for a specific address on a given blockchain.
   *
   * @param {string} blockchain - The blockchain network
   * @param {string} token - The token type
   * @param {string} address - The wallet address
   * @returns {Promise<{tokenBalance: {blockchain: string, token: string, amount: string}}>} Current token balance
   *
   * @example
   * ```javascript
   * const balance = await client.getTokenBalance('ethereum', 'usdt', '0x1234...');
   * console.log(`Balance: ${balance.tokenBalance.amount} ${balance.tokenBalance.token}`);
   * ```
   */
  async getTokenBalance (blockchain, token, address) {
    return this._request(
      'GET',
      `/api/v1/${blockchain}/${token}/${encodeURIComponent(
        address
      )}/token-balances`
    )
  }

  /**
   * Get batch token balances for multiple addresses
   *
   * Retrieve the current token balance for multiple addresses on blockchains.
   *
   * @param {Array<{blockchain: string, token: string, address: string}>} requests - Array of balance requests
   * @returns {Promise<Array<object>>} Array of balance responses (may contain errors for individual requests)
   *
   * @example
   * ```javascript
   * const results = await client.getBatchTokenBalances([
   *   { blockchain: 'ethereum', token: 'usdt', address: '0x1234...' },
   *   { blockchain: 'tron', token: 'usdt', address: 'T1234...' },
   * ]);
   * ```
   */
  async getBatchTokenBalances (requests) {
    return this._request('POST', '/api/v1/batch/token-balances', {
      body: requests
    })
  }
}

/**
 * Create a new WdkIndexerClient instance
 *
 * @param {object} config - Client configuration
 * @returns {WdkIndexerClient} A new WdkIndexerClient instance
 *
 * @example
 * ```javascript
 * const client = createClient({ apiKey: 'your-api-key' });
 * ```
 */
export function createClient (config) {
  return new WdkIndexerClient(config)
}

export default WdkIndexerClient
