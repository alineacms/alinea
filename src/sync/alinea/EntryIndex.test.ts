import {suite} from '@alinea/suite'
import {cms} from '../../test/cms.tsx'
import {FSSource} from '../source/FSSource.ts'
import {EntryIndex} from './EntryIndex.ts'

const test = suite(import.meta)

const dir = 'test/demo'
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
