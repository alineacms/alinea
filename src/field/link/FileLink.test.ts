import {expect, test} from 'bun:test'
import {file, filePicker} from './FileLink.js'
import {link} from './Link.js'
import {Field} from '#/core/Field.js'
import {text} from '#/field/text.js'

test('file picker allows any media file, including images', () => {
  const picker = filePicker(false, {})

  expect(picker.options.condition).toEqual({_type: 'MediaFile'})
})

test('generic link locations only constrain page links', () => {
  const location = {workspace: 'main', root: 'pages'}
  for (const {pickers} of [
    Field.options(link('Link', {location})),
    Field.options(link.multiple('Links', {location}))
  ]) {
    expect(pickers.entry.options.location).toEqual(location)
    expect(pickers.file.options.location).toBeUndefined()
  }
  expect(
    Field.options(file('File', {location})).pickers.file.options.location
  ).toEqual(location)
})

test('generic link page picker options do not leak into the file picker', () => {
  const fields = {caption: text('Caption')}
  const options = {
    limitLocations: [{workspace: 'main', root: 'pages'}],
    pickChildren: true,
    condition: {_type: 'Page'},
    enableNavigation: true,
    fields
  }
  for (const [multiple, {pickers}] of [
    [false, Field.options(link('Link', options))],
    [true, Field.options(link.multiple('Links', options))]
  ] as const) {
    const fileOptions = pickers.file.options
    expect(pickers.entry.options.limitLocations).toEqual(options.limitLocations)
    expect(pickers.entry.options.pickChildren).toBe(true)
    expect(fileOptions.limitLocations).toBeUndefined()
    expect(fileOptions.pickChildren).toBeUndefined()
    expect(fileOptions.enableNavigation).toBeUndefined()
    expect(fileOptions.condition).toEqual({_type: 'MediaFile'})
    expect(fileOptions.defaultView).toBe('thumb')
    expect(fileOptions.max).toBe(multiple ? undefined : 1)
    expect(fileOptions.fields).toBe(fields)
  }
})
