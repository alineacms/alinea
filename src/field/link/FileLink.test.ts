import {imageExtensions} from '#/core/media/IsImage.js'
import {expect, test} from 'bun:test'
import {file, filePicker} from './FileLink.js'
import {link} from './Link.js'
import {Field} from '#/core/Field.js'

test('file picker excludes image extensions case-insensitively', () => {
  const picker = filePicker(false, {})

  expect(JSON.stringify(picker.options.condition)).toBe(
    JSON.stringify({
      _type: 'MediaFile',
      extension: {
        notIn: [
          ...imageExtensions,
          ...imageExtensions.map(e => e.toUpperCase())
        ]
      }
    })
  )
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
