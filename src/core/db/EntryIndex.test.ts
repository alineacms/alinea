import {suite} from '@alinea/suite'
import {cms} from '../../test/cms.js'
import {FSSource} from '../source/FSSource.js'
import {EntryIndex} from './EntryIndex.js'

const test = suite(import.meta)

const dir = 'apps/web/content/demo'
const source = new FSSource(dir)

const index = new EntryIndex(cms.config)

test('sync', async () => {
  await index.syncWith(source)
})

test('re-sync', async () => {
  await index.syncWith(source)
})

test('re-re-sync', async () => {
  await index.syncWith(source)
})
