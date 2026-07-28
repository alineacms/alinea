import {suite} from '@alinea/suite'
import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import {ReactiveNode} from '#/dashboard/atoms/Dashboard.js'
import {createStore} from 'jotai'
import {documentUpdateAtom} from './RichTextState.js'

const test = suite(import.meta)

function paragraph(text: string) {
  return {_type: 'paragraph', content: [{_type: 'text', text}]}
}

test('document updates preserve reordered block node identity', () => {
  const block = {
    [Node.type]: 'Callout',
    [BlockNode.id]: 'block-1',
    title: 'Important'
  }
  const initial: TextDoc = [paragraph('Before'), block, paragraph('After')]
  const reactive = new ReactiveNode(initial)
  const store = createStore()
  const before = store.get(reactive.nodes) as Array<ReactiveNode>
  const blockNode = before[1]

  store.set(documentUpdateAtom(reactive), [
    paragraph('Before'),
    paragraph('After'),
    block
  ])

  const after = store.get(reactive.nodes) as Array<ReactiveNode>
  test.is(after[2], blockNode)
  test.equal(store.get(reactive.value), [
    paragraph('Before'),
    paragraph('After'),
    block
  ])
})

test('complex document updates retain every surviving block node', () => {
  const first = {
    [Node.type]: 'Callout',
    [BlockNode.id]: 'block-1',
    title: 'First'
  }
  const removed = {
    [Node.type]: 'Callout',
    [BlockNode.id]: 'block-2',
    title: 'Removed'
  }
  const last = {
    [Node.type]: 'Callout',
    [BlockNode.id]: 'block-3',
    title: 'Last'
  }
  const inserted = {
    [Node.type]: 'Callout',
    [BlockNode.id]: 'block-4',
    title: 'Inserted'
  }
  const reactive = new ReactiveNode<TextDoc>([
    paragraph('Before'),
    first,
    paragraph('Between first and removed'),
    removed,
    last,
    paragraph('After')
  ])
  const store = createStore()
  const before = store.get(reactive.nodes) as Array<ReactiveNode>
  const firstNode = before[1]
  const removedNode = before[3]
  const lastNode = before[4]

  const next: TextDoc = [
    last,
    paragraph('New leading text'),
    inserted,
    first,
    paragraph('New trailing text')
  ]
  store.set(documentUpdateAtom(reactive), next)

  const after = store.get(reactive.nodes) as Array<ReactiveNode>
  test.is(after[0], lastNode)
  test.is(after[3], firstNode)
  test.is(after.includes(removedNode), false)
  test.equal(store.get(reactive.value), next)
})

test('changing a block type keeps its position node and replaces its fields', () => {
  const reactive = new ReactiveNode<TextDoc>([
    {
      [Node.type]: 'Callout',
      [BlockNode.id]: 'block-1',
      title: 'Old field'
    }
  ])
  const store = createStore()
  const before = (store.get(reactive.nodes) as Array<ReactiveNode>)[0]
  const replacement = {
    [Node.type]: 'Banner',
    [BlockNode.id]: 'block-1',
    message: 'New field'
  }

  store.set(documentUpdateAtom(reactive), [replacement])

  const after = (store.get(reactive.nodes) as Array<ReactiveNode>)[0]
  test.is(after, before)
  test.equal(store.get(after.value), replacement)
})

test('block field updates propagate to the complete document value', () => {
  const reactive = new ReactiveNode<TextDoc>([
    {
      [Node.type]: 'Callout',
      [BlockNode.id]: 'block-1',
      title: 'Before'
    }
  ])
  const store = createStore()
  const document = store.get(reactive.nodes) as Array<ReactiveNode<object>>
  const block = store.get(document[0].nodes) as Record<string, ReactiveNode>
  let observed = store.get(reactive.value)
  const unsubscribe = store.sub(reactive.value, () => {
    observed = store.get(reactive.value)
  })

  store.set(block.title.value, 'After')
  unsubscribe()

  test.equal(observed, [
    {
      [Node.type]: 'Callout',
      [BlockNode.id]: 'block-1',
      title: 'After'
    }
  ])
})

test('equal text nodes are not rewritten during document reconciliation', () => {
  const value: TextDoc = [paragraph('Unchanged')]
  const reactive = new ReactiveNode(value)
  const store = createStore()
  const children = store.get(reactive.nodes) as Array<ReactiveNode>
  let updates = 0
  const unsubscribe = store.sub(children[0].value, () => updates++)

  store.set(documentUpdateAtom(reactive), [paragraph('Unchanged')])
  unsubscribe()

  test.is(updates, 0)
})

test('equivalent text nodes with different key order are not rewritten', () => {
  const reactive = new ReactiveNode<TextDoc>([
    {
      _type: 'paragraph',
      align: 'center',
      content: [{_type: 'text', text: 'Unchanged'}]
    }
  ])
  const store = createStore()
  const children = store.get(reactive.nodes) as Array<ReactiveNode>
  let updates = 0
  const unsubscribe = store.sub(children[0].value, () => updates++)

  store.set(documentUpdateAtom(reactive), [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'Unchanged'}],
      align: 'center'
    }
  ])
  unsubscribe()

  test.is(updates, 0)
})

test('field atoms update their backing reactive child', () => {
  const node = new ReactiveNode({title: 'Important'})
  const store = createStore()
  const title = node.field('title')
  const children = store.get(node.nodes) as Record<string, ReactiveNode>

  store.set(title, 'Persisted title')

  test.is(store.get(title), 'Persisted title')
  test.is(store.get(children.title.value), 'Persisted title')
})

test('reset restores nested reactive values', () => {
  const initial = [
    {_type: 'paragraph', content: [{_type: 'text', text: 'Before'}]}
  ]
  const node = new ReactiveNode({body: initial})
  const store = createStore()

  store.set(node.field('body'), [
    {_type: 'paragraph', content: [{_type: 'text', text: 'Changed'}]}
  ])
  store.set(node.reset)

  test.is(
    JSON.stringify(store.get(node.field('body'))),
    JSON.stringify(initial)
  )
})
