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

import test from 'brittle'

import { WdkIndexerClient } from '../bare.js'

test('bare runtime: exports indexer client', (t) => {
  t.ok(WdkIndexerClient, 'WdkIndexerClient should be exported')
  const client = new WdkIndexerClient({ apiKey: 'test-key' })
  t.ok(client, 'instance should be constructible')
  t.ok(typeof client.health === 'function', 'health should exist')
  t.ok(
    typeof client.getTokenTransfers === 'function',
    'getTokenTransfers should exist'
  )
  t.ok(
    typeof client.getTokenBalance === 'function',
    'getTokenBalance should exist'
  )
  t.ok(
    typeof client.getBatchTokenTransfers === 'function',
    'getBatchTokenTransfers should exist'
  )
  t.ok(
    typeof client.getBatchTokenBalances === 'function',
    'getBatchTokenBalances should exist'
  )
})
