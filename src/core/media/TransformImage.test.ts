import {expect, test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import sharp from 'sharp'
import {imageTransformPlan, isTransformableImage} from './ImageTransform.js'
import {transformImage} from './TransformImage.js'

// The fixture is 367 by 267 pixels
const example = new Blob([await readFile('test/fixtures/example.jpg')], {
  type: 'image/jpeg'
})

async function size(blob: Blob) {
  const {width, height, format} = await sharp(
    await blob.arrayBuffer()
  ).metadata()
  return {width, height, format}
}

test('images rotate, then crop, then scale down', async () => {
  const rotated = await transformImage(example, 'example.jpg', {
    edit: {rotate: 90}
  })
  expect(await size(rotated)).toEqual({width: 267, height: 367, format: 'jpeg'})
  const cropped = await transformImage(example, 'example.jpg', {
    edit: {rotate: 270, crop: {x: 0.5, y: 0, width: 0.5, height: 0.5}},
    resize: {maxWidth: 100}
  })
  expect(await size(cropped)).toEqual({width: 100, height: 138, format: 'jpeg'})
})

test('the exif orientation applies before the transform', async () => {
  const sideways = await sharp({
    create: {width: 40, height: 20, channels: 3, background: '#f00'}
  })
    .jpeg()
    .withMetadata({orientation: 6})
    .toBuffer()
  const resized = await transformImage(
    new Blob([sideways as BlobPart], {type: 'image/jpeg'}),
    'photo.jpg',
    {resize: {maxHeight: 20}}
  )
  expect(await size(resized)).toEqual({width: 10, height: 20, format: 'jpeg'})
})

test('images that fit, or can not be transformed, are left alone', async () => {
  const resize = {maxWidth: 2560, maxHeight: 2560}
  expect(await transformImage(example, 'example.jpg', {resize})).toBe(example)
  expect(
    await transformImage(example, 'example.jpg', {
      edit: {rotate: 0, crop: {x: 0, y: 0, width: 1, height: 1}}
    })
  ).toBe(example)
  expect(
    await transformImage(example, 'example.svg', {edit: {rotate: 90}})
  ).toBe(example)
  expect(imageTransformPlan(100, 50, {resize: {maxWidth: 200}})).toBe(undefined)
})

test('crop regions stay inside the image', () => {
  const plan = imageTransformPlan(100, 50, {
    edit: {crop: {x: 0.9, y: 0.9, width: 0.5, height: 0.5}}
  })
  expect(plan?.region).toEqual({left: 90, top: 45, width: 10, height: 5})
})

test('animated and vector images are not transformed', () => {
  const bytes = (...parts: Array<string | Array<number>>) =>
    new Uint8Array(
      parts.flatMap(part =>
        typeof part === 'string'
          ? Array.from(part, char => char.charCodeAt(0))
          : part
      )
    )
  const png = [0x89, ...bytes('PNG\r\n\x1a\n')]
  const ihdr = [...[0, 0, 0, 13], ...bytes('IHDR'), ...new Array(17).fill(0)]
  const chunk = (type: string) => [0, 0, 0, 0, ...bytes(type), 0, 0, 0, 0]
  const webp = (flags: number) =>
    bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8X', [10, 0, 0, 0, flags])
  expect(isTransformableImage('a.png', bytes(png, ihdr, chunk('IDAT')))).toBe(
    true
  )
  expect(
    isTransformableImage(
      'a.png',
      bytes(png, ihdr, chunk('acTL'), chunk('IDAT'))
    )
  ).toBe(false)
  expect(isTransformableImage('a.webp', webp(0))).toBe(true)
  expect(isTransformableImage('a.webp', webp(2))).toBe(false)
  expect(isTransformableImage('a.gif', new Uint8Array())).toBe(false)
  expect(isTransformableImage('a.svg', new Uint8Array())).toBe(false)
})
