import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {ReactiveNode} from './ReactiveNode.js'

interface Article {
  title: string
  metadata: {
    description?: string
  }
  tags: Array<string>
}

function articleNode(readOnly = false) {
  return new ReactiveNode<Article>(
    {
      title: 'First title',
      metadata: {},
      tags: ['news']
    },
    readOnly
  )
}

test('commits and resets nested editor changes as one document', () => {
  const store = createStore()
  const article = articleNode()
  const fields = store.get(article.nodes) as Record<keyof Article, ReactiveNode>

  store.set(article.field('title'), 'Published title')
  store.set(fields.metadata.field('description'), 'A short summary')
  store.set(fields.tags.push, 'featured')

  expect(store.get(article.value)).toEqual({
    title: 'Published title',
    metadata: {description: 'A short summary'},
    tags: ['news', 'featured']
  })
  expect(store.get(article.isDirty)).toBeTrue()

  store.set(article.commit)
  store.set(article.field('title'), 'Unsaved title')
  store.set(fields.metadata.field('description'), 'Unsaved summary')
  store.set(article.reset)

  expect(store.get(article.value)).toEqual({
    title: 'Published title',
    metadata: {description: 'A short summary'},
    tags: ['news', 'featured']
  })
  expect(store.get(article.isDirty)).toBeFalse()
})

test('rejects field and structural writes to a read-only document', () => {
  const store = createStore()
  const article = articleNode(true)
  const fields = store.get(article.nodes) as Record<keyof Article, ReactiveNode>

  store.set(article.field('title'), 'Changed')
  store.set(fields.metadata.field('description'), 'Added')
  store.set(fields.tags.push, 'featured')

  expect(store.get(article.value)).toEqual({
    title: 'First title',
    metadata: {},
    tags: ['news']
  })
  expect(store.get(article.isDirty)).toBeFalse()
})

test('keeps committed reset values isolated between stores', () => {
  const article = articleNode()
  const first = createStore()
  const second = createStore()

  first.set(article.field('title'), 'First store')
  first.set(article.commit)

  second.set(article.field('title'), 'Second store')
  second.set(article.reset)

  expect(first.get(article.value).title).toBe('First store')
  expect(second.get(article.value).title).toBe('First title')
})

test('applies functional updates when creating a missing field', () => {
  const article = articleNode()
  const store = createStore()
  const fields = store.get(article.nodes) as Record<keyof Article, ReactiveNode>

  store.set(fields.metadata.field('description'), (current: unknown) => {
    return typeof current === 'string' ? `${current}!` : 'Added'
  })

  expect(store.get(article.value).metadata.description).toBe('Added')
})
