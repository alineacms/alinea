import type {Field as FieldType} from '#/core/Field.js'
import {Config, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {atom, createStore} from 'jotai'
import {type EditorNode, EntryEditor} from './editor.js'

function fieldError(field: FieldType, initial: unknown) {
  const values = atom<Record<string, unknown>>({value: initial})
  const node: EditorNode = {
    readOnly: false,
    nodes: atom(null, () => {}),
    value: values,
    field(key) {
      return atom(
        get => get(values)[key],
        (get, set, next: unknown) => set(values, {...get(values), [key]: next})
      )
    }
  }
  const type = Config.type('Test', {fields: {value: field}})
  const editor = new EntryEditor(type, node)
  return createStore().get(editor.field('value')!.error)
}

test('validate returning true or nothing means valid', () => {
  expect(fieldError(Field.text('Title', {validate: () => true}), 'a')).toBe(
    undefined
  )
  expect(
    fieldError(Field.text('Title', {validate: () => undefined}), 'a')
  ).toBe(undefined)
})

test('validate returning false or a message marks the field invalid', () => {
  expect(fieldError(Field.text('Title', {validate: () => false}), 'a')).toBe(
    'Field is invalid'
  )
  expect(
    fieldError(Field.text('Title', {validate: () => 'Too short'}), 'a')
  ).toBe('Too short')
})

test('required is still checked when validate passes', () => {
  expect(
    fieldError(Field.text('Title', {required: true, validate: () => true}), '')
  ).toBe('Field is required')
})
