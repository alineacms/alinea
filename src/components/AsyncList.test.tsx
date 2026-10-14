import {act, renderHook, waitFor} from '#test/react.js'
import {expect, test} from 'bun:test'
import {useAsyncList} from './AsyncList.js'

interface Product {
  id: number
  title: string
}

const products: Array<Product> = [
  {id: 1, title: 'Chair'},
  {id: 2, title: 'Table'},
  {id: 3, title: 'Lamp'}
]

test('loads pages and passes sort and filter in alinea shapes', async () => {
  const calls: Array<unknown> = []
  const {result} = renderHook(() =>
    useAsyncList<Product, number>({
      initialSort: {column: 'title', direction: 'asc'},
      async load({cursor = 0, filterText, sort}) {
        calls.push({cursor, filterText, sort})
        return {
          items: products.slice(cursor, cursor + 2),
          cursor: cursor + 2 < products.length ? cursor + 2 : undefined
        }
      }
    })
  )
  await waitFor(() => expect(result.current.items.length).toBe(2))
  expect(result.current.hasMore).toBe(true)
  expect(result.current.sortDescriptor).toEqual({
    column: 'title',
    direction: 'asc'
  })
  act(() => result.current.loadMore())
  await waitFor(() => expect(result.current.items.length).toBe(3))
  expect(result.current.hasMore).toBe(false)
  act(() => result.current.sort({column: 'title', direction: 'desc'}))
  await waitFor(() =>
    expect(result.current.sortDescriptor?.direction).toBe('desc')
  )
  act(() => result.current.setFilterText('la'))
  await waitFor(() => expect(result.current.filterText).toBe('la'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(calls).toEqual([
    {cursor: 0, filterText: '', sort: {column: 'title', direction: 'asc'}},
    {cursor: 2, filterText: '', sort: {column: 'title', direction: 'asc'}},
    {cursor: 0, filterText: '', sort: {column: 'title', direction: 'desc'}},
    {cursor: 0, filterText: 'la', sort: {column: 'title', direction: 'desc'}}
  ])
})

test('selection takes read only sets', async () => {
  const {result} = renderHook(() =>
    useAsyncList<Product>({
      async load() {
        return {items: products}
      }
    })
  )
  await waitFor(() => expect(result.current.items.length).toBe(3))
  const keys: ReadonlySet<number> = new Set([2])
  act(() => result.current.setSelectedKeys(keys))
  expect(result.current.selectedKeys).toEqual(new Set([2]))
})

test('edits loaded items without loading again', async () => {
  let loads = 0
  const {result} = renderHook(() =>
    useAsyncList<Product>({
      async load() {
        loads++
        return {items: products}
      }
    })
  )
  await waitFor(() => expect(result.current.items.length).toBe(3))
  act(() => result.current.update(2, {id: 2, title: 'Desk'}))
  act(() => result.current.update(3, item => ({...item, title: 'Light'})))
  act(() => result.current.remove(1))
  act(() => result.current.prepend({id: 4, title: 'Stool'}))
  act(() => result.current.append({id: 5, title: 'Shelf'}))
  expect(result.current.items.map(item => item.title)).toEqual([
    'Stool',
    'Desk',
    'Light',
    'Shelf'
  ])
  expect(loads).toBe(1)
})
