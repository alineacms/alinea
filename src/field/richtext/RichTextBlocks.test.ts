import {suite} from '@alinea/suite'
import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import {ReactiveNode} from '#/dashboard/atoms/Dashboard.js'
import {createStore} from 'jotai'
import {richTextBlocksAtom, richTextStructureAtom} from './RichTextBlocks.js'

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

test('projects block identity without subscribing to its fields', () => {
  const reactive = new ReactiveNode<TextDoc>([
    {
      [Node.type]: 'Callout',
      [BlockNode.id]: 'block-1',
      title: 'Before'
    }
  ])
  const store = createStore()
  const documentAtom = richTextStructureAtom(reactive)
  const before = store.get(documentAtom)
  const [blockNode] = store.get(reactive.nodes) as Array<ReactiveNode<object>>
  const fields = store.get(blockNode.nodes) as Record<string, ReactiveNode>

  store.set(fields.title.value, 'After')

  test.is(store.get(documentAtom), before)
  test.equal(before.structure, [
    {[Node.type]: 'Callout', [BlockNode.id]: 'block-1'}
  ])
})

test('tracks block order and preserves its reactive node associations', () => {
  const first = {
    [Node.type]: 'Callout',
    [BlockNode.id]: 'block-1',
    title: 'First'
  }
  const second = {
    [Node.type]: 'Banner',
    [BlockNode.id]: 'block-2',
    title: 'Second'
  }
  const reactive = new ReactiveNode<TextDoc>([
    first,
    {_type: 'paragraph', content: [{_type: 'text', text: 'Between'}]},
    second
  ])
  const store = createStore()
  const blocksAtom = richTextBlocksAtom(reactive)
  const before = store.get(blocksAtom)

  store.set(reactive.move, 2, 0)

  const after = store.get(blocksAtom)
  test.equal(
    after.map(({id, index, typeName}) => ({id, index, typeName})),
    [
      {id: 'block-2', index: 0, typeName: 'Banner'},
      {id: 'block-1', index: 1, typeName: 'Callout'}
    ]
  )
  test.is(after[0]?.node, before[1]?.node)
  test.is(after[1]?.node, before[0]?.node)
})
