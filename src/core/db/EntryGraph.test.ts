import {suite} from '@alinea/suite'
import {cms} from '../../test/cms.js'
import {FSSource} from '../source/FSSource.js'
import {buildGraph} from './EntryGraph.js'

const test = suite(import.meta)

const dir = 'src/test/fixtures/demo'
const source = new FSSource(dir)

test('sync', async () => {
  const graph = await buildGraph(cms.config, source)
})

test('re-sync', async () => {
  const graph = await buildGraph(cms.config, source)
  graph.validate()
})

test('re-re-sync', async () => {
  const graph = await buildGraph(cms.config, source)
  graph.validate()
})
