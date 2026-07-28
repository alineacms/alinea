import {expect, test} from 'bun:test'
import {uploadSizeError} from './Upload.js'

test('reports files that exceed the configured upload limit', () => {
  const file = new File(['oversized'], 'photo.jpg')

  expect(uploadSizeError(file, file.size - 1)).toContain('photo.jpg')
  expect(uploadSizeError(file, file.size)).toBeUndefined()
  expect(uploadSizeError(file, undefined)).toBeUndefined()
})
