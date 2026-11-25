import {expect, test} from 'bun:test'
import {moveRow} from './FormRules.js'

const rows = [
  {_id: 'name', _type: 'text'},
  {_id: 'about', _type: 'section', inputs: [{_id: 'email', _type: 'email'}]},
  {_id: 'more', _type: 'section', inputs: []}
]

function ids(rows: Array<unknown>): Array<string> {
  return rows.map((row: any) =>
    row.inputs ? `${row._id}(${ids(row.inputs).join(' ')})` : row._id
  )
}

test('rows move into, out of and between sections', () => {
  expect(ids(moveRow(rows, 'name', 'about', 1))).toEqual([
    'about(email name)',
    'more()'
  ])
  expect(ids(moveRow(rows, 'email', undefined, 0))).toEqual([
    'email',
    'name',
    'about()',
    'more()'
  ])
  expect(ids(moveRow(rows, 'email', 'more', 0))).toEqual([
    'name',
    'about()',
    'more(email)'
  ])
})

test('rows stay without the row or section', () => {
  expect(moveRow(rows, 'missing', 'about', 0)).toBe(rows)
  expect(moveRow(rows, 'name', 'missing', 0)).toBe(rows)
  expect(moveRow(rows, 'about', 'about', 0)).toBe(rows)
})
