'use strict'

const AbortController = require('#abort-controller')
const defaultFetch = require('#fetch')
const { URLSearchParams } = require('#url')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError
} = require('./errors.js')

const DEFAULT_BASE_URL = 'https://wdk-api.tether.io'
const API_PREFIX = '/api/v1'
const DEFAULT_TIMEOUT = 30000

/**
 * HTTP client for the WDK Indexer API.
 *
 * Every method returns a promise. Besides the errors listed per method, any call
 * can reject with WdkIndexerTimeoutError (no response within `timeout`) or
 * WdkIndexerNetworkError (the request failed before a response arrived). Every
 * method except health() and getChains() rejects with WdkIndexerError
 * if no API key is configured.
 *
 * Addresses are URI-encoded, because a TON address in standard base64 contains
 * '/' and '+'. The other path parameters (blockchain, token, txHash, walletId)
 * are inserted into the URL as given. See "Path parameters" in the README.
 */
class WdkIndexerClient {
  // Private, so console.log(client) and JSON.stringify(client) never show the key.
  #apiKey

  /**
   * @param {object} [config]
   * @param {string} [config.apiKey] sent as X-API-KEY; required by every method except health() and getChains()
   * @param {string} [config.baseUrl] defaults to https://wdk-api.tether.io
   * @param {number} [config.timeout] request timeout in ms, defaults to 30000
   * @param {import('../index.js').FetchLike} [config.fetch] custom fetch implementation, used instead of the runtime's
   */
  constructor ({ apiKey, baseUrl = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT, fetch = defaultFetch } = {}) {
    this._origin = baseUrl.replace(/\/+$/, '')
    this.#apiKey = apiKey
    this._timeout = timeout
    this._fetch = fetch
  }

  /**
   * Send a request and resolve with the parsed JSON body.
   *
   * @param {string} method
   * @param {string} path e.g. '/wallets/w1', relative to /api/v1
   * @param {object} [opts]
   * @param {object} [opts.query] sent as the query string; keys set to undefined or null are left out
   * @param {*} [opts.body] sent as JSON
   * @param {boolean} [opts.auth] send X-API-KEY and require a key (default true)
   * @param {number[]} [opts.okStatuses] extra statuses that count as success when they carry a JSON body
   * @returns {Promise<*>}
   * @throws {WdkIndexerError} if auth is required and no API key is set
   * @throws {WdkIndexerTimeoutError} if no response arrives within `timeout`
   * @throws {WdkIndexerNetworkError} if the request fails before a response
   * @throws {WdkIndexerApiError} on a non-success status
   * @throws {WdkIndexerError} if a success response is not valid JSON
   */
  async _request (method, path, { query, body, auth = true, okStatuses = [] } = {}) {
    if (auth && !this.#apiKey) throw new WdkIndexerError('API key is required')

    // Drop undefined and null: Node's URLSearchParams sends them as text,
    // Bare's skips them, and both runtimes must build the same URL.
    // The loose `!= null` is intentional: it matches both undefined and null, keeping 0, '' and false.
    const qs = new URLSearchParams(Object.entries(query || {}).filter(([, v]) => v != null)).toString()
    const url = this._origin + API_PREFIX + path + (qs && `?${qs}`)

    const headers = { Accept: 'application/json' }
    if (auth) headers['X-API-KEY'] = this.#apiKey

    const controller = new AbortController()
    const init = { method, headers, signal: controller.signal }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const timeout = this._timeout
    let timer
    const timedOut = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new WdkIndexerTimeoutError(timeout))
        controller.abort()
      }, timeout)
    })

    // Call fetch as a plain function, not as this._fetch(), which would pass the
    // client as `this`. A browser's native fetch throws "Illegal invocation" for
    // any `this` other than undefined or the global object.
    const fetch = this._fetch
    const send = async () => {
      try {
        const response = await fetch(url, init)
        return { response, text: await response.text() }
      } catch (err) {
        throw new WdkIndexerNetworkError(err)
      }
    }

    let result
    try {
      result = await Promise.race([send(), timedOut])
    } finally {
      clearTimeout(timer)
    }

    const { response, text } = result
    let value
    try {
      value = text ? JSON.parse(text) : null
    } catch {
      if (response.ok) throw new WdkIndexerError('Invalid JSON in response (HTTP ' + response.status + ')')
      throw new WdkIndexerApiError(response.status, response.statusText, text)
    }
    // An extra "ok" status (health 503) only counts when it carries a JSON body;
    // an empty or HTML 503 from a proxy is a plain API error.
    if (response.ok || (okStatuses.includes(response.status) && value !== null)) return value
    throw new WdkIndexerApiError(response.status, response.statusText, value)
  }

  /**
   * GET /health, the deep health check. Needs no API key.
   * Resolves with the body on 200 and on 503 (status 'degraded' or 'unhealthy').
   *
   * @returns {Promise<import('../index.js').HealthResponse>}
   * @throws {WdkIndexerApiError} on any other error status, or a 503 without a JSON body
   */
  async health () {
    return this._request('GET', '/health', { auth: false, okStatuses: [503] })
  }

  /**
   * GET /chains: supported blockchains, their tokens and address case rules. Needs no API key.
   *
   * @returns {Promise<import('../index.js').ChainsResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getChains () {
    return this._request('GET', '/chains', { auth: false })
  }

  /**
   * GET /{blockchain}/{token}/{address}/token-transfers.
   *
   * @param {import('../index.js').Blockchain} blockchain
   * @param {import('../index.js').Token} token
   * @param {string} address wallet address
   * @param {import('../index.js').TokenTransferOptions} [options] limit, fromTs, toTs; sent as the query string
   * @returns {Promise<import('../index.js').TokenTransfersResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTokenTransfers (blockchain, token, address, options) {
    return this._request('GET', `/${blockchain}/${token}/${encodeURIComponent(address)}/token-transfers`, { query: options })
  }

  /**
   * GET /{blockchain}/{token}/{address}/token-balances.
   *
   * @param {import('../index.js').Blockchain} blockchain
   * @param {import('../index.js').Token} token
   * @param {string} address wallet address
   * @returns {Promise<import('../index.js').TokenBalanceResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTokenBalance (blockchain, token, address) {
    return this._request('GET', `/${blockchain}/${token}/${encodeURIComponent(address)}/token-balances`)
  }

  /**
   * GET /blockchains/{blockchain}/{token}/token-transfers/{txHash}: the transfers inside one transaction.
   *
   * @param {import('../index.js').Blockchain} blockchain
   * @param {import('../index.js').Token} token
   * @param {string} txHash transaction hash
   * @returns {Promise<import('../index.js').TransactionTransfersResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTransactionTransfers (blockchain, token, txHash) {
    return this._request('GET', `/blockchains/${blockchain}/${token}/token-transfers/${txHash}`)
  }

  /**
   * POST /batch/token-transfers. Results come back in request order; failed items are ApiError objects (see isApiError()).
   *
   * @param {import('../index.js').BatchTokenTransferRequest[]} requests 1 to BATCH_LIMIT items
   * @returns {Promise<import('../index.js').BatchTokenTransfersItem[]>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getBatchTokenTransfers (requests) {
    return this._request('POST', '/batch/token-transfers', { body: requests })
  }

  /**
   * POST /batch/token-balances. Results come back in request order; failed items are ApiError objects (see isApiError()).
   *
   * @param {import('../index.js').BatchTokenBalanceRequest[]} requests 1 to BATCH_LIMIT items
   * @returns {Promise<import('../index.js').BatchTokenBalancesItem[]>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getBatchTokenBalances (requests) {
    return this._request('POST', '/batch/token-balances', { body: requests })
  }

  /**
   * POST /wallets: register wallets whose transfers the server keeps syncing.
   *
   * @param {import('../index.js').WalletRegistration[]} wallets 1 to BATCH_LIMIT wallets
   * @returns {Promise<import('../index.js').RegisterWalletsResponse>} one result per wallet, each with its own status
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async registerWallets (wallets) {
    return this._request('POST', '/wallets', { body: wallets })
  }

  /**
   * GET /wallets.
   *
   * @returns {Promise<import('../index.js').ListWalletsResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async listWallets () {
    return this._request('GET', '/wallets')
  }

  /**
   * GET /wallets/{walletId}.
   *
   * @param {string} walletId
   * @returns {Promise<import('../index.js').Wallet>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getWallet (walletId) {
    return this._request('GET', `/wallets/${walletId}`)
  }

  /**
   * PATCH /wallets/{walletId}: rename a wallet or turn its syncing on or off.
   *
   * @param {string} walletId
   * @param {import('../index.js').WalletUpdate} patch name, enabled, or both
   * @returns {Promise<import('../index.js').Wallet>} the updated wallet
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async updateWallet (walletId, patch) {
    return this._request('PATCH', `/wallets/${walletId}`, { body: patch })
  }

  /**
   * DELETE /wallets/{walletId}.
   *
   * @param {string} walletId
   * @returns {Promise<import('../index.js').DeleteWalletResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async deleteWallet (walletId) {
    return this._request('DELETE', `/wallets/${walletId}`)
  }

  /**
   * GET /wallets/{walletId}/transfers: transfers synced for one wallet.
   *
   * @param {string} walletId
   * @param {import('../index.js').TransferFilters} [filters] sent as the query string
   * @returns {Promise<import('../index.js').WalletTransfersResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getWalletTransfers (walletId, filters) {
    return this._request('GET', `/wallets/${walletId}/transfers`, { query: filters })
  }

  /**
   * GET /transfers: transfers synced across all registered wallets.
   *
   * @param {import('../index.js').TransferFilters} [filters] sent as the query string
   * @returns {Promise<import('../index.js').WalletTransfersResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTransfers (filters) {
    return this._request('GET', '/transfers', { query: filters })
  }
}

module.exports = { WdkIndexerClient }
