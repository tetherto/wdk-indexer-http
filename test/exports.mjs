import test from 'brittle'
import { WdkIndexerClient } from '@tetherto/wdk-indexer-http'
import * as esm from '@tetherto/wdk-indexer-http'
import * as bare from '@tetherto/wdk-indexer-http/bare'
import cjs from '../index.js'

test('ESM exposes every CJS export by name', (t) => {
  const names = Object.keys(esm).filter((k) => k !== 'default' && k !== 'module.exports')
  t.alike(names.sort(), Object.keys(cjs).sort())
  for (const key of Object.keys(cjs)) t.is(esm[key], cjs[key], key)
})

test('the default import is the exports object, not the client', (t) => {
  t.is(esm.default, cjs)
})

test('import of the ./bare alias resolves the same module', (t) => {
  t.is(bare.WdkIndexerClient, WdkIndexerClient)
})
