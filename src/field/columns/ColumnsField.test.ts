import type {ColumnsListValue} from '#/field/list/ColumnsListField.js'
import {
  appendColumn,
  equalColumnSpans,
  groupColumnsList,
  insertColumnsRow,
  moveColumnsRow,
  removeColumnsRow,
  resizeColumnBoundary
} from '#/field/list/ColumnsListField.js'
import {list} from '#/field/list.js'
import {text} from '#/field/text.js'
import {expect, test} from 'bun:test'

function item(id: string, row?: string, span?: number): ColumnsListValue {
  return {
    _id: id,
    _index: id,
    _type: 'Text',
    _layout: row && span ? {row, span} : undefined
  }
}

test('list.columns remains a flat list field with layout metadata', () => {
  const field = list.columns('Fields', {
    schema: {Text: type('Text', {fields: {label: text('Label')}})},
    initialValue: [
      {_type: 'Text', _layout: {row: 'main', span: 12}, label: 'Name'}
    ]
  })
  const options = getField(field).options
  const value = options.initialValue as Array<ColumnsListValue>
  expect(options.columns).toBe(true)
  expect(value).toHaveLength(1)
  expect(value[0]._layout).toEqual({row: 'main', span: 12})
  expect('columns' in value[0]).toBe(false)
})

test('legacy list items become independent full-width rows', () => {
  const groups = groupColumnsList([item('one'), item('two')])
  expect(groups.map(group => group.id)).toEqual(['one', 'two'])
  expect(groups.map(group => group.items[0].layout.span)).toEqual([12, 12])
})

test('adding a column groups it and balances the row', () => {
  const values = [item('one', 'address', 12)]
  const next = appendColumn(values, 'address', item('two'))
  expect(next.map(value => value._layout)).toEqual([
    {row: 'address', span: 6},
    {row: 'address', span: 6}
  ])
  expect(equalColumnSpans(3)).toEqual([4, 4, 4])
})

test('resizing preserves the pair total and minimum', () => {
  const values = [item('one', 'address', 6), item('two', 'address', 6)]
  const resized = resizeColumnBoundary(values, 'one', 'two', 3)
  expect(resized.map(value => value._layout?.span)).toEqual([3, 9])
  const clamped = resizeColumnBoundary(resized, 'one', 'two', 1)
  expect(clamped.map(value => value._layout?.span)).toEqual([2, 10])
})

test('removing an anonymous row removes all its columns', () => {
  const values = [
    item('one', 'address', 6),
    item('two', 'address', 6),
    item('three', 'contact', 12)
  ]
  expect(removeColumnsRow(values, 'address').map(value => value._id)).toEqual([
    'three'
  ])
})

test('moves an anonymous row with all of its columns', () => {
  const values = [
    item('one', 'address', 6),
    item('two', 'address', 6),
    item('three', 'contact', 12)
  ]
  const moved = moveColumnsRow(values, 'address', 'contact', 'after')
  expect(moved.map(value => value._id)).toEqual(['three', 'one', 'two'])
})

test('inserts an anonymous row before another group', () => {
  const values = [item('one', 'address', 12), item('two', 'contact', 12)]
  const inserted = insertColumnsRow(
    values,
    'contact',
    [item('three', 'extra', 12)],
    'before'
  )
  expect(inserted.map(value => value._id)).toEqual(['one', 'three', 'two'])
})
import {getField} from '#/core/Internal.js'
import {type} from '#/core/Type.js'
