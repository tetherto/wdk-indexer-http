'use strict'

const test = require('brittle')

test('require() of the ./bare alias resolves the same module', (t) => {
  t.is(require('@tetherto/wdk-indexer-http/bare'), require('@tetherto/wdk-indexer-http'))
})

test('#fetch resolves to the runtime fetch', (t) => {
  const fetch = require('#fetch')
  t.is(typeof fetch, 'function')
  if (typeof Bare !== 'undefined') t.is(fetch, require('bare-fetch'), 'bare-fetch on Bare')
  else t.is(fetch, require('../lib/fetch.js'), 'global fetch wrapper on Node')
})

const NAMES = [
  'WdkIndexerClient',
  'WdkIndexerError',
  'WdkIndexerApiError',
  'WdkIndexerTimeoutError',
  'WdkIndexerNetworkError',
  'WdkIndexerValidationError',
  'isApiError',
  'BATCH_LIMIT'
]

test('require() exposes exactly the public API', (t) => {
  const api = require('@tetherto/wdk-indexer-http')
  t.alike(Object.keys(api).sort(), NAMES.slice().sort())
  t.is(api.BATCH_LIMIT, 10)
  t.absent(api.createClient, 'createClient is removed')
  t.is(api.WdkIndexerClient, require('../lib/client.js').WdkIndexerClient)
  t.is(api.WdkIndexerApiError, require('../lib/errors.js').WdkIndexerApiError)
})
