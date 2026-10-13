import {useState} from 'react'
import {useAsyncList as useAsyncListPrimitive} from 'react-aria-components'
import type {Key, Selection, SortDescriptor} from './types.js'

export interface AsyncListLoadOptions<C> {
  /** Aborted when a newer load replaces this one */
  signal: AbortSignal
  /** The cursor returned by the previous page, set when loading more */
  cursor?: C
  filterText: string
  sort?: SortDescriptor
}

export interface AsyncListPage<T, C> {
  items: Iterable<T>
  /** Where the next page starts, leave out when there are no more items */
  cursor?: C | null
}

export interface AsyncListOptions<T, C> {
  load(options: AsyncListLoadOptions<C>): Promise<AsyncListPage<T, C>>
  initialSort?: SortDescriptor
  initialFilterText?: string
  initialSelectedKeys?: Iterable<Key>
  /** The key of an item, defaults to its `id` or `key` property */
  getKey?: (item: T) => Key
}

/**
 * Items loaded page by page. Its fields plug into Table (`items`,
 * `sortDescriptor`/`onSortChange`, `loading`, `onLoadMore`, `selectedKeys`/
 * `onSelectionChange`) and ComboBox (`inputValue`/`onInputValueChange`,
 * `loading`).
 */
export interface AsyncList<T> {
  items: Array<T>
  /** True while loading the first page, the next page, sorting or filtering */
  loading: boolean
  /** The error the last load failed with */
  error?: Error
  /** Whether the last page returned a cursor */
  hasMore: boolean
  loadMore(): void
  reload(): void
  /** Replaces an item, eg. after saving it, without loading the list again */
  update(key: Key, item: T | ((previous: T) => T)): void
  remove(...keys: Array<Key>): void
  prepend(...items: Array<T>): void
  append(...items: Array<T>): void
  sortDescriptor?: SortDescriptor
  sort(descriptor: SortDescriptor): void
  filterText: string
  setFilterText(text: string): void
  selectedKeys: Selection
  setSelectedKeys(keys: Selection): void
}

type AriaSort = {column: Key; direction: 'ascending' | 'descending'}

function toAria(sort: SortDescriptor | undefined): AriaSort | undefined {
  if (!sort) return undefined
  const direction = sort.direction === 'asc' ? 'ascending' : 'descending'
  return {column: sort.column, direction}
}

function fromAria(sort: AriaSort | undefined): SortDescriptor | undefined {
  if (!sort) return undefined
  return {
    column: sort.column,
    direction: sort.direction === 'ascending' ? 'asc' : 'desc'
  }
}

/** Loads a list of items, with sorting, filtering and paging */
export function useAsyncList<T, C = string>({
  load,
  initialSort,
  initialFilterText,
  initialSelectedKeys,
  getKey
}: AsyncListOptions<T, C>): AsyncList<T> {
  const [hasMore, setHasMore] = useState(false)
  const list = useAsyncListPrimitive<T, C>({
    initialSortDescriptor: toAria(initialSort),
    initialFilterText,
    initialSelectedKeys,
    getKey,
    async load({signal, cursor, filterText = '', sortDescriptor}) {
      const page = await load({
        signal,
        cursor,
        filterText,
        sort: fromAria(sortDescriptor as AriaSort | undefined)
      })
      if (!signal.aborted) setHasMore(page.cursor != null)
      return {items: page.items, cursor: page.cursor ?? undefined}
    }
  })
  return {
    items: list.items,
    loading: list.isLoading,
    error: list.error,
    hasMore,
    loadMore: list.loadMore,
    reload: list.reload,
    update: list.update,
    remove: list.remove,
    prepend: list.prepend,
    append: list.append,
    sortDescriptor: fromAria(list.sortDescriptor as AriaSort | undefined),
    sort: descriptor => list.sort(toAria(descriptor)!),
    filterText: list.filterText,
    setFilterText: list.setFilterText,
    selectedKeys: list.selectedKeys,
    setSelectedKeys: keys =>
      list.setSelectedKeys(keys === 'all' ? keys : new Set(keys))
  }
}
