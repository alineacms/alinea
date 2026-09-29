import {expect, test} from 'bun:test'
import {imageResizeTarget, isResizableImage} from './ImageResize.js'

test('images larger than the options scale down with their aspect ratio', () => {
  expect(imageResizeTarget('photo.JPG', 4000, 3000, {maxWidth: 2000})).toEqual({
    width: 2000,
    height: 1500,
    type: 'image/jpeg',
    quality: 0.85
  })
  expect(
    imageResizeTarget('scan.png', 1000, 4000, {
      maxWidth: 2000,
      maxHeight: 2000,
      quality: 0.7
    })
  ).toEqual({width: 500, height: 2000, type: 'image/png', quality: 0.7})
})

test('images that fit or cannot be resized are left alone', () => {
  expect(
    imageResizeTarget('photo.jpg', 1200, 800, {maxWidth: 2000})
  ).toBeUndefined()
  expect(
    imageResizeTarget('logo.svg', 4000, 4000, {maxWidth: 100})
  ).toBeUndefined()
  expect(
    imageResizeTarget('animation.gif', 4000, 4000, {maxWidth: 100})
  ).toBeUndefined()
  expect(isResizableImage('photo.webp')).toBe(true)
  expect(isResizableImage('document.pdf')).toBe(false)
})
