import {imageExtensions} from '#/core/media/IsImage.js'
import {expect, test} from 'bun:test'
import {filePicker} from './FileLink.js'

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
