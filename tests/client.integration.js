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
 * Integration tests for WdkIndexerClient
 *
 * These tests require a valid API key set in the WDK_INDEXER_API_KEY environment variable.
 * Run with: WDK_INDEXER_API_KEY=your-api-key npm run test:integration
 */

import test from 'brittle'
import {
  WdkIndexerClient,
  isTokenTransfersResponse,
  isTokenBalanceResponse
} from '../index.js'

const API_KEY = process.env.WDK_INDEXER_API_KEY

if (!API_KEY) {
  console.log('Skipping integration tests: WDK_INDEXER_API_KEY not set')
  process.exit(0)
}

const client = new WdkIndexerClient({ apiKey: API_KEY })

test('integration - health check', async (t) => {
  const health = await client.health()
  t.is(health.status, 'ok')
  t.ok(health.timestamp)
})

test('integration - getTokenBalance', async (t) => {
  // USDt contract on Ethereum
  const balance = await client.getTokenBalance(
    'ethereum',
    'usdt',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  )

  t.ok(balance.tokenBalance)
  t.is(balance.tokenBalance.blockchain, 'ethereum')
  t.is(balance.tokenBalance.token, 'usdt')
  t.ok(balance.tokenBalance.amount)
})

test('integration - getTokenTransfers', async (t) => {
  const transfers = await client.getTokenTransfers(
    'ethereum',
    'usdt',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    { limit: 5 }
  )

  t.ok(transfers.transfers)
  t.ok(transfers.transfers.length <= 5)
  if (transfers.transfers.length > 0) {
    const transfer = transfers.transfers[0]
    t.ok(transfer.blockchain)
    t.ok(transfer.transactionHash)
    t.ok(transfer.amount)
  }
})

test('integration - getBatchTokenBalances', async (t) => {
  const results = await client.getBatchTokenBalances([
    {
      blockchain: 'ethereum',
      token: 'usdt',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    }
  ])

  t.is(results.length, 1)
  t.ok(isTokenBalanceResponse(results[0]))
})

test('integration - getBatchTokenTransfers', async (t) => {
  const results = await client.getBatchTokenTransfers([
    {
      blockchain: 'ethereum',
      token: 'usdt',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      limit: 2
    }
  ])

  t.is(results.length, 1)
  t.ok(isTokenTransfersResponse(results[0]))
})
