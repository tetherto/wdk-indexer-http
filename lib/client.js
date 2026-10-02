'use strict'

const { createRequester } = require('./request.js')

/**
 * HTTP client for the WDK Indexer API.
 *
 * Every method returns a promise. Besides the errors listed per method, any call
 * can reject with WdkIndexerTimeoutError (no response within `timeout`) or
 * WdkIndexerNetworkError (the request failed before a response arrived). Every
 * method except health() and getChains() rejects with WdkIndexerValidationError
 * if no API key is configured or a path parameter is empty, '.' or '..'.
 */
class WdkIndexerClient {
  /**
   * @param {object} [config]
   * @param {string} [config.apiKey] sent as X-API-KEY; required by every method except health() and getChains()
   * @param {string} [config.baseUrl] defaults to https://wdk-api.tether.su
   * @param {number} [config.timeout] request timeout in ms, defaults to 30000
   * @param {import('../index.js').FetchLike} [config.fetch] custom fetch implementation, used instead of the runtime's
   */
  constructor ({ apiKey, baseUrl, timeout, fetch } = {}) {
    this._request = createRequester({ apiKey, baseUrl, timeout, fetch })
  }

  /**
   * GET /health, the deep health check. Needs no API key.
   * Resolves with the body on 200 and on 503 (status 'degraded' or 'unhealthy').
   *
   * @returns {Promise<import('../index.js').HealthResponse>}
   * @throws {WdkIndexerApiError} on any other error status, or a 503 without a JSON body
   */
  health () {
    return this._request('GET', ['health'], { auth: false, okStatuses: [503] })
  }

  /**
   * GET /chains: supported blockchains, their tokens and address case rules. Needs no API key.
   *
   * @returns {Promise<import('../index.js').ChainsResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getChains () {
    return this._request('GET', ['chains'], { auth: false })
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
  getTokenTransfers (blockchain, token, address, options) {
    return this._request('GET', [{ blockchain }, { token }, { address }, 'token-transfers'], { query: options })
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
  getTokenBalance (blockchain, token, address) {
    return this._request('GET', [{ blockchain }, { token }, { address }, 'token-balances'])
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
  getTransactionTransfers (blockchain, token, txHash) {
    return this._request('GET', ['blockchains', { blockchain }, { token }, 'token-transfers', { txHash }])
  }

  /**
   * POST /batch/token-transfers. Results come back in request order; failed items are ApiError objects (see isApiError()).
   *
   * @param {import('../index.js').BatchTokenTransferRequest[]} requests 1 to BATCH_LIMIT items
   * @returns {Promise<import('../index.js').BatchTokenTransfersItem[]>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getBatchTokenTransfers (requests) {
    return this._request('POST', ['batch', 'token-transfers'], { body: requests })
  }

  /**
   * POST /batch/token-balances. Results come back in request order; failed items are ApiError objects (see isApiError()).
   *
   * @param {import('../index.js').BatchTokenBalanceRequest[]} requests 1 to BATCH_LIMIT items
   * @returns {Promise<import('../index.js').BatchTokenBalancesItem[]>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getBatchTokenBalances (requests) {
    return this._request('POST', ['batch', 'token-balances'], { body: requests })
  }

  /**
   * POST /wallets: register wallets whose transfers the server keeps syncing.
   *
   * @param {import('../index.js').WalletRegistration[]} wallets 1 to BATCH_LIMIT wallets
   * @returns {Promise<import('../index.js').RegisterWalletsResponse>} one result per wallet, each with its own status
   * @throws {WdkIndexerApiError} on a non-success response
   */
  registerWallets (wallets) {
    return this._request('POST', ['wallets'], { body: wallets })
  }

  /**
   * GET /wallets.
   *
   * @returns {Promise<import('../index.js').ListWalletsResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  listWallets () {
    return this._request('GET', ['wallets'])
  }

  /**
   * GET /wallets/{walletId}.
   *
   * @param {string} walletId
   * @returns {Promise<import('../index.js').Wallet>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getWallet (walletId) {
    return this._request('GET', ['wallets', { walletId }])
  }

  /**
   * PATCH /wallets/{walletId}: rename a wallet or turn its syncing on or off.
   *
   * @param {string} walletId
   * @param {import('../index.js').WalletUpdate} patch name, enabled, or both
   * @returns {Promise<import('../index.js').Wallet>} the updated wallet
   * @throws {WdkIndexerApiError} on a non-success response
   */
  updateWallet (walletId, patch) {
    return this._request('PATCH', ['wallets', { walletId }], { body: patch })
  }

  /**
   * DELETE /wallets/{walletId}.
   *
   * @param {string} walletId
   * @returns {Promise<import('../index.js').DeleteWalletResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  deleteWallet (walletId) {
    return this._request('DELETE', ['wallets', { walletId }])
  }

  /**
   * GET /wallets/{walletId}/transfers: transfers synced for one wallet.
   *
   * @param {string} walletId
   * @param {import('../index.js').TransferFilters} [filters] sent as the query string
   * @returns {Promise<import('../index.js').WalletTransfersResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getWalletTransfers (walletId, filters) {
    return this._request('GET', ['wallets', { walletId }, 'transfers'], { query: filters })
  }

  /**
   * GET /transfers: transfers synced across all registered wallets.
   *
   * @param {import('../index.js').TransferFilters} [filters] sent as the query string
   * @returns {Promise<import('../index.js').WalletTransfersResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getTransfers (filters) {
    return this._request('GET', ['transfers'], { query: filters })
  }
}

module.exports = { WdkIndexerClient }
