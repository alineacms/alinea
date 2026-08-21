import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {ReactiveNode} from './ReactiveNode.js'

interface Article {
  title: string
  metadata: {
    description?: string
    generated?: string
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

test('commits persisted data into each nested reset snapshot', () => {
  const store = createStore()
  const article = articleNode()
  const fields = store.get(article.nodes) as Record<keyof Article, ReactiveNode>
  const metadata = fields.metadata

  store.set(article.field('title'), 'Submitted title')
  store.set(metadata.field('description'), 'Submitted summary')
  store.set(article.commit, {
    title: 'Persisted title',
    metadata: {description: 'Persisted summary'},
    tags: ['news', 'featured']
  })

  expect(store.get(article.value)).toEqual({
    title: 'Persisted title',
    metadata: {description: 'Persisted summary'},
    tags: ['news', 'featured']
  })
  expect(store.get(article.isDirty)).toBeFalse()
  expect(
    (store.get(article.nodes) as Record<keyof Article, ReactiveNode>).metadata
  ).toBe(metadata)

  store.set(metadata.field('description'), 'Unsaved summary')
  store.set(metadata.reset)
  expect(store.get(article.value).metadata.description).toBe(
    'Persisted summary'
  )
  expect(store.get(article.isDirty)).toBeFalse()
})

test('rebases edits made while persisted data was pending', () => {
  const store = createStore()
  const article = articleNode()
  const fields = store.get(article.nodes) as Record<keyof Article, ReactiveNode>
  const metadata = fields.metadata

  store.set(article.field('title'), 'Submitted title')
  store.set(metadata.field('description'), 'Submitted summary')
  store.set(fields.tags.push, 'submitted')
  const checkpoint = store.get(article.value)

  store.set(article.field('title'), 'Typed while saving')
  store.set(metadata.field('description'), 'Edited while saving')
  const tags = store.get(fields.tags.nodes) as Array<ReactiveNode<string>>
  store.set(tags[0].value, 'local news')
  store.set(article.rebase, {
    checkpoint,
    saved: {
      title: 'Submitted title',
      metadata: {
        description: 'Submitted summary',
        generated: 'Added while saving'
      },
      tags: ['news', 'submitted', 'persisted']
    }
  })

  expect(store.get(article.value)).toEqual({
    title: 'Typed while saving',
    metadata: {
      description: 'Edited while saving',
      generated: 'Added while saving'
    },
    tags: ['local news', 'submitted', 'persisted']
  })
  expect(store.get(article.isDirty)).toBeTrue()

  store.set(article.reset)
  expect(store.get(article.value)).toEqual({
    title: 'Submitted title',
    metadata: {
      description: 'Submitted summary',
      generated: 'Added while saving'
    },
    tags: ['news', 'submitted', 'persisted']
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
