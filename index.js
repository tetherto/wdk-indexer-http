'use strict'

const { WdkIndexerClient } = require('./lib/client.js')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError
} = require('./lib/errors.js')

// Most items the server accepts per batch request or registerWallets() call.
const BATCH_LIMIT = 10

// Keep this a plain object literal: Node and Bare read the names from it to
// support named ESM imports of this CommonJS file.
module.exports = {
  WdkIndexerClient,
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError,
  BATCH_LIMIT
}
