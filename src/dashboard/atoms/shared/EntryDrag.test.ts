import {expect, test} from 'bun:test'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragType,
  dashboardEntryDragTypes
} from './EntryDrag.js'

test('creates dashboard entry drag data with a plain text fallback', () => {
  expect(dashboardEntryDragItem(42)).toEqual({
    'text/plain': '42',
    [dashboardEntryDragType]: '42'
  })
  expect(dashboardEntryDragTypes).toEqual([
    dashboardEntryDragType,
    'text/plain'
  ])
})

test('accepts dashboard entry and plain text drag types', () => {
  expect(
    acceptsDashboardEntryDrag(new Set([dashboardEntryDragType]))
  ).toBeTrue()
  expect(acceptsDashboardEntryDrag(new Set(['text/plain']))).toBeTrue()
  expect(acceptsDashboardEntryDrag(new Set(['application/json']))).toBeFalse()
})
