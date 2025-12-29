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

import test from 'brittle'
import {
  WdkIndexerClient,
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  isApiError,
  isTokenTransfersResponse,
  isTokenBalanceResponse,
  BLOCKCHAINS,
  TOKENS,
  createClient
} from '../index.js'

test('WdkIndexerClient - constructor requires apiKey', async (t) => {
  t.exception(() => new WdkIndexerClient({}), /API key is required/)
  t.exception(
    () => new WdkIndexerClient({ apiKey: '' }),
    /API key is required/
  )
})

test('WdkIndexerClient - constructor sets defaults', async (t) => {
  const client = new WdkIndexerClient({ apiKey: 'test-key' })

  t.is(client.apiKey, 'test-key')
  t.is(client.baseUrl, 'https://wdk-api.tether.io')
  t.is(client.timeout, 30000)
})

test('WdkIndexerClient - constructor accepts custom config', async (t) => {
  const client = new WdkIndexerClient({
    apiKey: 'test-key',
    baseUrl: 'https://custom.example.com/',
    timeout: 60000
  })

  t.is(client.apiKey, 'test-key')
  t.is(client.baseUrl, 'https://custom.example.com')
  t.is(client.timeout, 60000)
})

test('createClient - creates WdkIndexerClient instance', async (t) => {
  const client = createClient({ apiKey: 'test-key' })
  t.ok(client instanceof WdkIndexerClient)
})

test('BLOCKCHAINS - contains expected blockchains', async (t) => {
  t.ok(BLOCKCHAINS.includes('ethereum'))
  t.ok(BLOCKCHAINS.includes('tron'))
  t.ok(BLOCKCHAINS.includes('ton'))
  t.ok(BLOCKCHAINS.includes('bitcoin'))
  t.ok(BLOCKCHAINS.includes('polygon'))
  t.ok(BLOCKCHAINS.includes('arbitrum'))
  t.is(BLOCKCHAINS.length, 9)
})

test('TOKENS - contains expected tokens', async (t) => {
  t.ok(TOKENS.includes('usdt'))
  t.ok(TOKENS.includes('xaut'))
  t.ok(TOKENS.includes('btc'))
  t.is(TOKENS.length, 3)
})

test('isApiError - returns true for API errors', async (t) => {
  t.ok(isApiError({ error: 'NotFound', message: 'Not found', status: 404 }))
  t.absent(isApiError({ transfers: [] }))
  t.absent(isApiError(null))
  t.absent(isApiError(undefined))
  t.absent(isApiError({ error: 'test' }))
})

test('isTokenTransfersResponse - returns true for transfer responses', async (t) => {
  t.ok(isTokenTransfersResponse({ transfers: [] }))
  t.absent(isTokenTransfersResponse({ tokenBalance: {} }))
  t.absent(isTokenTransfersResponse({ error: 'test' }))
})

test('isTokenBalanceResponse - returns true for balance responses', async (t) => {
  t.ok(
    isTokenBalanceResponse({
      tokenBalance: { blockchain: 'ethereum', token: 'usdt', amount: '100' }
    })
  )
  t.absent(isTokenBalanceResponse({ transfers: [] }))
  t.absent(isTokenBalanceResponse({ error: 'test' }))
})

test('WdkIndexerError - extends Error', async (t) => {
  const error = new WdkIndexerError('test message')
  t.ok(error instanceof Error)
  t.is(error.name, 'WdkIndexerError')
  t.is(error.message, 'test message')
})

test('WdkIndexerApiError - includes status and errorType', async (t) => {
  const error = new WdkIndexerApiError({
    error: 'NotFound',
    message: 'Resource not found',
    status: 404
  })
  t.ok(error instanceof WdkIndexerError)
  t.is(error.name, 'WdkIndexerApiError')
  t.is(error.status, 404)
  t.is(error.errorType, 'NotFound')
  t.is(error.message, 'Resource not found')
})

test('WdkIndexerTimeoutError - includes timeout value', async (t) => {
  const error = new WdkIndexerTimeoutError(5000)
  t.ok(error instanceof WdkIndexerError)
  t.is(error.name, 'WdkIndexerTimeoutError')
  t.ok(error.message.includes('5000'))
})

test('WdkIndexerNetworkError - includes cause', async (t) => {
  const cause = new Error('Connection refused')
  const error = new WdkIndexerNetworkError('Network error', cause)
  t.ok(error instanceof WdkIndexerError)
  t.is(error.name, 'WdkIndexerNetworkError')
  t.is(error.cause, cause)
})

test('WdkIndexerClient - health with mock fetch', async (t) => {
  const mockFetch = async (url, options) => {
    t.ok(url.endsWith('/api/v1/health'))
    t.is(options.headers['x-api-key'], 'test-key')
    return {
      ok: true,
      json: async () => ({
        status: 'ok',
        timestamp: '2025-01-01T00:00:00.000Z'
      })
    }
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })
  const result = await client.health()

  t.is(result.status, 'ok')
  t.is(result.timestamp, '2025-01-01T00:00:00.000Z')
})

test('WdkIndexerClient - getTokenBalance with mock fetch', async (t) => {
  const mockFetch = async (url, options) => {
    t.ok(url.includes('/api/v1/ethereum/usdt/0x1234/token-balances'))
    t.is(options.headers['x-api-key'], 'test-key')
    return {
      ok: true,
      json: async () => ({
        tokenBalance: {
          blockchain: 'ethereum',
          token: 'usdt',
          amount: '1000000'
        }
      })
    }
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })
  const result = await client.getTokenBalance('ethereum', 'usdt', '0x1234')

  t.is(result.tokenBalance.blockchain, 'ethereum')
  t.is(result.tokenBalance.token, 'usdt')
  t.is(result.tokenBalance.amount, '1000000')
})

test('WdkIndexerClient - getTokenTransfers with mock fetch', async (t) => {
  const mockFetch = async (url, options) => {
    t.ok(url.includes('/api/v1/ethereum/usdt/0x1234/token-transfers'))
    t.ok(url.includes('limit=10'))
    t.ok(url.includes('fromTs=1000'))
    t.is(options.headers['x-api-key'], 'test-key')
    return {
      ok: true,
      json: async () => ({
        transfers: [
          {
            blockchain: 'ethereum',
            blockNumber: 12345,
            transactionHash: '0xabc',
            transferIndex: 0,
            token: 'usdt',
            amount: '500000',
            timestamp: 1000,
            from: '0xfrom',
            to: '0xto'
          }
        ]
      })
    }
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })
  const result = await client.getTokenTransfers('ethereum', 'usdt', '0x1234', {
    limit: 10,
    fromTs: 1000
  })

  t.is(result.transfers.length, 1)
  t.is(result.transfers[0].amount, '500000')
})

test('WdkIndexerClient - getBatchTokenBalances with mock fetch', async (t) => {
  const mockFetch = async (url, options) => {
    t.ok(url.includes('/api/v1/batch/token-balances'))
    t.is(options.method, 'POST')
    const body = JSON.parse(options.body)
    t.is(body.length, 2)
    return {
      ok: true,
      json: async () => [
        {
          tokenBalance: {
            blockchain: 'ethereum',
            token: 'usdt',
            amount: '100'
          }
        },
        { tokenBalance: { blockchain: 'tron', token: 'usdt', amount: '200' } }
      ]
    }
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })
  const result = await client.getBatchTokenBalances([
    { blockchain: 'ethereum', token: 'usdt', address: '0x1234' },
    { blockchain: 'tron', token: 'usdt', address: 'T1234' }
  ])

  t.is(result.length, 2)
  t.ok(isTokenBalanceResponse(result[0]))
  t.ok(isTokenBalanceResponse(result[1]))
})

test('WdkIndexerClient - getBatchTokenTransfers with mock fetch', async (t) => {
  const mockFetch = async (url, options) => {
    t.ok(url.includes('/api/v1/batch/token-transfers'))
    t.is(options.method, 'POST')
    return {
      ok: true,
      json: async () => [
        { transfers: [{ amount: '100' }] },
        { error: 'NotFound', message: 'Address not found', status: 404 }
      ]
    }
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })
  const result = await client.getBatchTokenTransfers([
    { blockchain: 'ethereum', token: 'usdt', address: '0x1234' },
    { blockchain: 'tron', token: 'usdt', address: 'T1234' }
  ])

  t.is(result.length, 2)
  t.ok(isTokenTransfersResponse(result[0]))
  t.ok(isApiError(result[1]))
})

test('WdkIndexerClient - handles API error response', async (t) => {
  const mockFetch = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({
      error: 'Unauthorized',
      message: 'Invalid API key',
      status: 401
    })
  })

  const client = new WdkIndexerClient({
    apiKey: 'invalid-key',
    fetch: mockFetch
  })

  try {
    await client.health()
    t.fail('Should have thrown')
  } catch (error) {
    t.ok(error instanceof WdkIndexerApiError)
    t.is(error.status, 401)
    t.is(error.errorType, 'Unauthorized')
  }
})

test('WdkIndexerClient - handles network error', async (t) => {
  const mockFetch = async () => {
    throw new Error('Connection refused')
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })

  try {
    await client.health()
    t.fail('Should have thrown')
  } catch (error) {
    t.ok(error instanceof WdkIndexerNetworkError)
    t.ok(error.message.includes('Connection refused'))
  }
})

test('WdkIndexerClient - handles timeout', async (t) => {
  const mockFetch = async (url, options) => {
    // Simulate abort signal
    if (options.signal) {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
  }

  const client = new WdkIndexerClient({
    apiKey: 'test-key',
    timeout: 100,
    fetch: mockFetch
  })

  try {
    await client.health()
    t.fail('Should have thrown')
  } catch (error) {
    t.ok(error instanceof WdkIndexerTimeoutError)
  }
})

test('WdkIndexerClient - encodes address in URL', async (t) => {
  const mockFetch = async (url) => {
    t.ok(url.includes('0x1234%2F5678'))
    return {
      ok: true,
      json: async () => ({
        tokenBalance: { blockchain: 'ethereum', token: 'usdt', amount: '0' }
      })
    }
  }

  const client = new WdkIndexerClient({ apiKey: 'test-key', fetch: mockFetch })
  await client.getTokenBalance('ethereum', 'usdt', '0x1234/5678')
})
