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

interface Row {
  _id: string
  _type: string
  _index: string
  title?: string
  items?: Array<Row>
}

function row(id: string, index = ''): Row {
  return {_id: id, _type: 'Text', _index: index}
}

function listNode(keys: Array<string>) {
  return new ReactiveNode<Array<Row>>(
    keys.map((key, at) => row(String.fromCharCode(97 + at), key))
  )
}

function orderOf(rows: Array<Row>) {
  return rows.map(row => row._id).join('')
}

function expectOrdered(rows: Array<Row>) {
  for (let at = 1; at < rows.length; at++)
    expect(rows[at - 1]._index < rows[at]._index).toBeTrue()
  for (const row of rows) expect(row._index).not.toBe('')
}

test('assigns an order key to pushed and inserted list rows', () => {
  const store = createStore()
  const list = listNode(['a0', 'a1', 'a2'])
  store.set(list.push, row('end'))
  store.set(list.insert, 0, row('start'))
  store.set(list.insert, 2, row('middle'))
  const rows = store.get(list.value)
  expect(rows.map(row => row._id)).toEqual([
    'start',
    'a',
    'middle',
    'b',
    'c',
    'end'
  ])
  expectOrdered(rows)
  expect(rows[1]._index).toBe('a0')
  expect(rows[3]._index).toBe('a1')
  expect(rows[4]._index).toBe('a2')
  expect(store.get(list.isDirty)).toBeTrue()
})

test('assigns a fresh key to a cloned row carrying a copied key', () => {
  const store = createStore()
  const list = listNode(['a0', 'a1'])
  const [first] = store.get(list.value)
  store.set(list.insert, 1, {...first, _id: 'copy'})
  const rows = store.get(list.value)
  expect(orderOf(rows)).toBe('acopyb')
  expectOrdered(rows)
  expect(rows[1]._index).not.toBe('a0')
})

test('gives a moved row a key between its new neighbours', () => {
  const store = createStore()
  const list = listNode(['a0', 'a1', 'a2', 'a3'])
  store.set(list.move, 1, 2)
  let rows = store.get(list.value)
  expect(orderOf(rows)).toBe('acbd')
  expectOrdered(rows)
  expect(
    rows.map(row => row._index).filter(key => key !== rows[2]._index)
  ).toEqual(['a0', 'a2', 'a3'])
  store.set(list.move, 2, 1)
  rows = store.get(list.value)
  expect(orderOf(rows)).toBe('abcd')
  expectOrdered(rows)
  store.set(list.move, 3, 0)
  rows = store.get(list.value)
  expect(orderOf(rows)).toBe('dabc')
  expectOrdered(rows)
  expect(rows.slice(1).map(row => row._index)).toEqual(['a0', 'a1', 'a2'])
  store.set(list.move, 0, 3)
  rows = store.get(list.value)
  expect(orderOf(rows)).toBe('abcd')
  expectOrdered(rows)
  expect(rows.slice(0, 3).map(row => row._index)).toEqual(['a0', 'a1', 'a2'])
})

test('rekeys the moved row even in a list of two', () => {
  const store = createStore()
  const list = listNode(['a0', 'a1'])
  store.set(list.move, 1, 0)
  const rows = store.get(list.value)
  expect(orderOf(rows)).toBe('ba')
  expect(rows[1]._index).toBe('a0')
  expectOrdered(rows)
})

test('repairs missing keys around inserted rows', () => {
  const store = createStore()
  const list = listNode(['', '', ''])
  store.set(list.insert, 1, row('new'))
  const rows = store.get(list.value)
  expect(orderOf(rows)).toBe('anewbc')
  expectOrdered(rows)
})

test('assigns keys to rows written as a whole list value', () => {
  const store = createStore()
  const list = listNode(['a0', 'a1'])
  store.set(list.value, rows => [...rows, row('added')])
  const rows = store.get(list.value)
  expect(orderOf(rows)).toBe('abadded')
  expectOrdered(rows)
  expect(rows.slice(0, 2).map(row => row._index)).toEqual(['a0', 'a1'])
})

test('assigns keys in a list nested in a rich text block', () => {
  const store = createStore()
  const doc = new ReactiveNode<Array<Record<string, unknown>>>([
    {_type: 'paragraph', content: [{_type: 'text', text: 'Hi'}]},
    {_type: 'Block', _id: 'block', items: [row('a', 'a0'), row('b', 'a1')]}
  ])
  const [paragraph, block] = store.get(doc.nodes) as Array<ReactiveNode>
  const items = (store.get(block.nodes) as Record<string, ReactiveNode>)
    .items as ReactiveNode<Array<Row>>
  store.set(items.insert, 1, row('new'))
  store.set(items.move, 2, 0)
  const rows = store.get(items.value)
  expect(orderOf(rows)).toBe('banew')
  expectOrdered(rows)
  expect(rows[1]._index).toBe('a0')
  // Rich text nodes carry no order key
  store.set(doc.insert, 1, {_type: 'paragraph'})
  store.set(doc.move, 0, 2)
  expect(store.get(doc.value).map(node => Object.keys(node))).toEqual([
    ['_type'],
    ['_type', '_id', 'items'],
    ['_type', 'content']
  ])
  expect(store.get(paragraph.value)).not.toHaveProperty('_index')
})

test('keeps persisted rows exactly as committed', () => {
  const store = createStore()
  const list = listNode(['a0'])
  const saved = [row('x'), row('y')]
  store.set(list.commit, saved)
  expect(store.get(list.value)).toEqual(saved)
  expect(store.get(list.isDirty)).toBeFalse()
})
