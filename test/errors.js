'use strict'

const test = require('brittle')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError
} = require('../lib/errors.js')

test('every error extends WdkIndexerError and Error, with its own name', (t) => {
  const errors = [
    new WdkIndexerApiError(400, 'Bad Request', null),
    new WdkIndexerTimeoutError(10),
    new WdkIndexerNetworkError(new Error('boom')),
    new WdkIndexerValidationError('bad')
  ]
  for (const err of errors) {
    t.ok(err instanceof WdkIndexerError)
    t.ok(err instanceof Error)
    t.is(err.name, err.constructor.name)
  }
  t.is(new WdkIndexerError('x').name, 'WdkIndexerError')
})

test('WdkIndexerApiError takes message and errorType from a JSON body', (t) => {
  const body = { error: 'Bad Request', message: 'Invalid address', status: 400 }
  const err = new WdkIndexerApiError(400, 'Bad Request', body)
  t.is(err.status, 400)
  t.is(err.errorType, 'Bad Request')
  t.is(err.message, 'Invalid address')
  t.is(err.body, body)
})

test('WdkIndexerApiError falls back to HTTP status line', (t) => {
  const raw = new WdkIndexerApiError(502, 'Bad Gateway', '<html>oops</html>')
  t.is(raw.message, 'HTTP 502 Bad Gateway')
  t.is(raw.errorType, null)
  t.is(raw.body, '<html>oops</html>')

  const empty = new WdkIndexerApiError(500, '', null)
  t.is(empty.message, 'HTTP 500')
  t.is(empty.body, null)

  const noMessage = new WdkIndexerApiError(418, 'Teapot', { error: 'Teapot' })
  t.is(noMessage.message, 'HTTP 418 Teapot')
  t.is(noMessage.errorType, 'Teapot')
})

test('WdkIndexerTimeoutError exposes the timeout', (t) => {
  const err = new WdkIndexerTimeoutError(1500)
  t.is(err.timeout, 1500)
  t.is(err.message, 'Request timed out after 1500ms')
})

test('WdkIndexerNetworkError keeps the cause', (t) => {
  const cause = new Error('ECONNREFUSED')
  const err = new WdkIndexerNetworkError(cause)
  t.is(err.cause, cause)
  t.is(err.message, 'Network request failed: ECONNREFUSED')
  t.is(new WdkIndexerNetworkError('weird').message, 'Network request failed')
})

test('isApiError detects batch error items', (t) => {
  t.ok(isApiError({ error: 'Bad Request', message: 'Invalid address' }))
  t.ok(isApiError({ error: 'Bad Request', status: 400 }), 'message and status are optional in the spec')
  t.ok(isApiError({ error: 'Bad Request' }))
  t.absent(isApiError({ error: 400, message: 'x' }))
  t.absent(isApiError({ message: 'x' }))
  t.absent(isApiError({ tokenBalance: { amount: '1' } }))
  t.absent(isApiError({ transfers: [] }))
  t.absent(isApiError(null))
  t.absent(isApiError('error'))
})

test('WdkIndexerApiError ignores non-string error and empty message', (t) => {
  const numeric = new WdkIndexerApiError(400, 'Bad Request', { error: 123, message: 'x' })
  t.is(numeric.errorType, null)
  t.is(numeric.message, 'x')

  const blank = new WdkIndexerApiError(400, 'Bad Request', { error: 'E', message: '' })
  t.is(blank.message, 'HTTP 400 Bad Request')
  t.is(blank.errorType, 'E')

  const list = new WdkIndexerApiError(400, 'Bad Request', [1])
  t.is(list.message, 'HTTP 400 Bad Request')
  t.is(list.errorType, null)
})
