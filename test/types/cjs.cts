// Type test for the CommonJS entry, checked by `npm run test:types` (never executed).
import api = require('@tetherto/wdk-indexer-http')
import bare = require('@tetherto/wdk-indexer-http/bare')

const client = new api.WdkIndexerClient({ apiKey: 'key' })
const other: api.WdkIndexerClient = new bare.WdkIndexerClient()
const limit: 10 = api.BATCH_LIMIT

export async function check (): Promise<void> {
  const { chains } = await client.getChains()
  const name: string = chains[0].name
  void name
  void other
  void limit
  // @ts-expect-error the CommonJS entry has no default export at runtime
  void api.default
}
