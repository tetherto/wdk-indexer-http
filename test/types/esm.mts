// Type test for the ESM entry, checked by `npm run test:types` (never executed).
import {
  WdkIndexerClient,
  WdkIndexerApiError,
  WdkIndexerError,
  isApiError,
  BATCH_LIMIT,
  type BatchTokenBalancesItem,
  type TokenBalanceResponse,
  type WalletTransfersResponse
} from '@tetherto/wdk-indexer-http'
import { WdkIndexerClient as BareClient } from '@tetherto/wdk-indexer-http/bare'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
function assertType<T extends true> (): T | void {}

const client: WdkIndexerClient = new WdkIndexerClient({ apiKey: 'key', timeout: 1000 })
const bare = new BareClient()
assertType<Equal<typeof BareClient, typeof WdkIndexerClient>>()
assertType<Equal<typeof BATCH_LIMIT, 10>>()

export async function check (): Promise<void> {
  const balance = await client.getTokenBalance('ethereum', 'usdt', '0xabc')
  assertType<Equal<typeof balance, TokenBalanceResponse>>()
  await bare.getTokenBalance('plasma', 'doge', '0xabc') // unknown names are allowed

  const items = await client.getBatchTokenBalances([{ blockchain: 'tron', token: 'usdt', address: 'T1' }])
  for (const item of items) {
    assertType<Equal<typeof item, BatchTokenBalancesItem>>()
    if (isApiError(item)) {
      const error: string = item.error
      const message: string | undefined = item.message
      void error
      void message
    } else {
      const amount: string = item.tokenBalance.amount
      void amount
    }
  }

  const transfers = await client.getTransfers({ from: 0, to: '2025-01-01T00:00:00Z', sort: 'asc' })
  assertType<Equal<typeof transfers, WalletTransfersResponse>>()

  try {
    await client.listWallets()
  } catch (err) {
    if (err instanceof WdkIndexerApiError) {
      const status: number = err.status
      const type: string | null = err.errorType
      void status
      void type
    }
    if (err instanceof WdkIndexerError) void err.message
  }

  // @ts-expect-error unknown config key
  new WdkIndexerClient({ apikey: 'key' }) // eslint-disable-line no-new
  // @ts-expect-error bad sort value
  await client.getTransfers({ sort: 'newest' })
  // @ts-expect-error empty patch
  await client.updateWallet('w1', {})
  // @ts-expect-error batch item without address
  await client.getBatchTokenTransfers([{ blockchain: 'ethereum', token: 'usdt' }])
}
