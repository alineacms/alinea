import {suite} from '@alinea/suite'
import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import {ReactiveNode} from '#/dashboard/store/Dashboard.js'
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
