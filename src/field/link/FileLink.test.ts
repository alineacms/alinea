import {expect, test} from 'bun:test'
import {file, filePicker} from './FileLink.js'
import {link} from './Link.js'
import {Field} from '#/core/Field.js'

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
