'use strict'

/** Base class for every error thrown by this package. */
class WdkIndexerError extends Error {
  /** @param {string} message */
  constructor (message) {
    super(message)
    this.name = this.constructor.name
  }
}

/** The API answered with a non-success status. */
class WdkIndexerApiError extends WdkIndexerError {
  /**
   * @param {number} status HTTP status code
   * @param {string} statusText HTTP status text
   * @param {*} body parsed JSON body, raw text, or null when empty
   */
  constructor (status, statusText, body) {
    const json = body !== null && typeof body === 'object'
    const message = json && typeof body.message === 'string' && body.message
      ? body.message
      : ('HTTP ' + status + ' ' + (statusText || '')).trim()
    super(message)
    this.status = status
    this.errorType = json && typeof body.error === 'string' ? body.error : null
    this.body = body
  }
}

/** The request did not complete within the configured timeout. */
class WdkIndexerTimeoutError extends WdkIndexerError {
  /** @param {number} timeout timeout in milliseconds */
  constructor (timeout) {
    super('Request timed out after ' + timeout + 'ms')
    this.timeout = timeout
  }
}

/** The request failed before an HTTP response was received. */
class WdkIndexerNetworkError extends WdkIndexerError {
  /** @param {*} cause the underlying error */
  constructor (cause) {
    super('Network request failed' + (cause && cause.message ? ': ' + cause.message : ''))
    this.cause = cause
  }
}

/** Arguments failed client-side shape validation; no request was sent. */
class WdkIndexerValidationError extends WdkIndexerError {}

/**
 * True when a batch result item is an error entry ({ error, message?, status? }).
 * Success items never carry an `error` field, so a string `error` is enough.
 * @param {*} item
 * @returns {boolean}
 */
function isApiError (item) {
  return item !== null && typeof item === 'object' && typeof item.error === 'string'
}

module.exports = {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError
}
