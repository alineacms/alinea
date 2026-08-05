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
