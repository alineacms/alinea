import {suite} from '@alinea/suite'
import {type TextDoc} from '#/core/TextDoc.js'
import {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import {createStore} from 'jotai'
import {richTextBlocksAtom} from './RichTextBlocks.js'

const test = suite(import.meta)

test('nested block edits do not invalidate the block index', () => {
  const reactive = new ReactiveNode<TextDoc>([
    {_type: 'paragraph', content: [{_type: 'text', text: 'Before'}]},
    {_type: 'Callout', _id: 'block-1', title: 'Initial'},
    {_type: 'paragraph', content: [{_type: 'text', text: 'After'}]}
  ])
  const store = createStore()
  const blocksAtom = richTextBlocksAtom(reactive)
  const before = store.get(blocksAtom)
  const nodes = store.get(reactive.nodes) as Array<ReactiveNode>
  const blockFields = store.get(nodes[1].nodes) as Record<string, ReactiveNode>

  store.set(blockFields.title.value, 'Changed')

  test.is(store.get(blocksAtom), before)
})
