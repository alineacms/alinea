import {expect, test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import sharp from 'sharp'
import {editImage} from './EditImage.js'
import {cropRegion, hasImageEdit} from './ImageEdit.js'

const example = new Blob([await readFile('test/fixtures/example.jpg')], {
  type: 'image/jpeg'
})

async function size(blob: Blob) {
  const {width, height, format} = await sharp(
    await blob.arrayBuffer()
  ).metadata()
  return {width, height, format}
}

test('images rotate before the crop applies', async () => {
  // The fixture is 367 by 267 pixels
  const rotated = await editImage(example, 'example.jpg', {rotate: 90})
  expect(await size(rotated)).toEqual({width: 267, height: 367, format: 'jpeg'})
  const cropped = await editImage(example, 'example.jpg', {
    rotate: 270,
    crop: {x: 0.5, y: 0, width: 0.5, height: 0.5}
  })
  expect(await size(cropped)).toEqual({width: 133, height: 184, format: 'jpeg'})
})

test('edits without changes keep the original', async () => {
  expect(await editImage(example, 'example.jpg', {rotate: 0})).toBe(example)
  expect(
    await editImage(example, 'example.jpg', {
      crop: {x: 0, y: 0, width: 1, height: 1}
    })
  ).toBe(example)
  expect(await editImage(example, 'example.svg', {rotate: 90})).toBe(example)
  expect(hasImageEdit({crop: {x: 0, y: 0, width: 0.5, height: 1}})).toBe(true)
})

test('crop regions stay inside the image', () => {
  expect(
    cropRegion({x: 0.9, y: 0.9, width: 0.5, height: 0.5}, 100, 50)
  ).toEqual({left: 90, top: 45, width: 10, height: 5})
  expect(cropRegion(undefined, 100, 50)).toEqual({
    left: 0,
    top: 0,
    width: 100,
    height: 50
  })
})
