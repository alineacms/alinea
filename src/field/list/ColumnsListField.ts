import type {ListRow, ListRowLayout} from '#/core/ListRow.js'
import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'

export const columnsTracks = 12
export const columnsMax = 4
export const columnsMinSpan = 2

export interface ColumnsListValue extends ListRow {
  [key: string]: unknown
}

export interface ColumnsListItem {
  index: number
  layout: ListRowLayout
  value: ColumnsListValue
}

export interface ColumnsListGroup {
  id: string
  items: Array<ColumnsListItem>
}

export function columnLayout(value: ColumnsListValue): ListRowLayout {
  const layout = value._layout
  if (
    layout &&
    typeof layout.row === 'string' &&
    Number.isInteger(layout.span) &&
    layout.span > 0 &&
    layout.span <= columnsTracks
  ) {
    return layout
  }
  return {row: value._id, span: columnsTracks}
}

export function groupColumnsList(
  values: Array<ColumnsListValue>
): Array<ColumnsListGroup> {
  const groups = new Map<string, ColumnsListGroup>()
  for (const [index, value] of values.entries()) {
    const layout = columnLayout(value)
    const group = groups.get(layout.row) ?? {id: layout.row, items: []}
    group.items.push({index, layout, value})
    groups.set(layout.row, group)
  }
  return Array.from(groups.values())
}

export function equalColumnSpans(count: number): Array<number> {
  if (count < 1 || count > columnsMax)
    throw new RangeError(`Column count must be between 1 and ${columnsMax}`)
  const base = Math.floor(columnsTracks / count)
  const remainder = columnsTracks % count
  return Array.from({length: count}, (_, index) => {
    return base + (index < remainder ? 1 : 0)
  })
}

export function appendColumn(
  values: Array<ColumnsListValue>,
  rowId: string,
  value: ColumnsListValue
): Array<ColumnsListValue> {
  const group = groupColumnsList(values).find(group => group.id === rowId)
  if (!group || group.items.length >= columnsMax) return values
  const spans = equalColumnSpans(group.items.length + 1)
  const lastIndex = group.items[group.items.length - 1].index
  const groupedIds = new Map(
    group.items.map((item, index) => [item.value._id, spans[index]])
  )
  const next = values.map(item => {
    const span = groupedIds.get(item._id)
    return span === undefined ? item : {...item, _layout: {row: rowId, span}}
  })
  next.splice(lastIndex + 1, 0, {
    ...value,
    _layout: {row: rowId, span: spans[spans.length - 1]}
  })
  return reindexColumnsList(next)
}

export function removeColumnsRow(
  values: Array<ColumnsListValue>,
  rowId: string
): Array<ColumnsListValue> {
  return reindexColumnsList(
    values.filter(value => columnLayout(value).row !== rowId)
  )
}

export function insertColumnsRow(
  values: Array<ColumnsListValue>,
  targetRowId: string,
  row: Array<ColumnsListValue>,
  position: 'before' | 'after'
): Array<ColumnsListValue> {
  const targetIndexes = values.flatMap((value, index) => {
    return columnLayout(value).row === targetRowId ? [index] : []
  })
  if (!targetIndexes.length) return values
  const insertAt =
    position === 'before'
      ? targetIndexes[0]
      : targetIndexes[targetIndexes.length - 1] + 1
  const next = [...values]
  next.splice(insertAt, 0, ...row)
  return reindexColumnsList(next)
}

export function moveColumnsRow(
  values: Array<ColumnsListValue>,
  rowId: string,
  targetRowId: string,
  position: 'before' | 'after'
): Array<ColumnsListValue> {
  if (rowId === targetRowId) return values
  const moving = values.filter(value => columnLayout(value).row === rowId)
  if (!moving.length) return values
  const remaining = values.filter(value => columnLayout(value).row !== rowId)
  const targetIndexes = remaining.flatMap((value, index) => {
    return columnLayout(value).row === targetRowId ? [index] : []
  })
  if (!targetIndexes.length) return values
  const insertAt =
    position === 'before'
      ? targetIndexes[0]
      : targetIndexes[targetIndexes.length - 1] + 1
  remaining.splice(insertAt, 0, ...moving)
  return reindexColumnsList(remaining)
}

export function resizeColumnBoundary(
  values: Array<ColumnsListValue>,
  leftId: string,
  rightId: string,
  nextLeft: number,
  minSpan = columnsMinSpan
): Array<ColumnsListValue> {
  const left = values.find(value => value._id === leftId)
  const right = values.find(value => value._id === rightId)
  if (!left || !right) return values
  const leftLayout = columnLayout(left)
  const rightLayout = columnLayout(right)
  if (leftLayout.row !== rightLayout.row) return values
  const total = leftLayout.span + rightLayout.span
  const leftSpan = Math.max(minSpan, Math.min(total - minSpan, nextLeft))
  return values.map(value => {
    if (value._id === leftId)
      return {...value, _layout: {...leftLayout, span: leftSpan}}
    if (value._id === rightId)
      return {...value, _layout: {...rightLayout, span: total - leftSpan}}
    return value
  })
}

export function reindexColumnsList(
  values: Array<ColumnsListValue>
): Array<ColumnsListValue> {
  const keys = generateNKeysBetween(null, null, values.length)
  return values.map((value, index) => ({...value, _index: keys[index]}))
}
