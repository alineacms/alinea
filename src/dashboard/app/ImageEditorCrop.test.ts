import {expect, test} from 'bun:test'
import {
  fitCrop,
  fullCrop,
  moveCrop,
  resizeCrop,
  rotateCrop
} from './ImageEditorCrop.js'

const crop = {x: 0.1, y: 0.2, width: 0.3, height: 0.4}

test('crops follow the image when it rotates', () => {
  const turned = rotateCrop(crop, 1)
  expect(turned.x).toBeCloseTo(0.4)
  expect([turned.y, turned.width, turned.height]).toEqual([0.1, 0.4, 0.3])
  const back = rotateCrop(rotateCrop(crop, 1), -1)
  expect(back.x).toBeCloseTo(crop.x)
  expect(back.y).toBeCloseTo(crop.y)
  expect(back.width).toBeCloseTo(crop.width)
})

test('crops fit a ratio around their center', () => {
  expect(fitCrop(fullCrop, 2)).toEqual({x: 0, y: 0.25, width: 1, height: 0.5})
  expect(fitCrop(fullCrop, 0.5)).toEqual({x: 0.25, y: 0, width: 0.5, height: 1})
})

test('crops move and resize inside the image', () => {
  expect(moveCrop(crop, 1, -1)).toEqual({x: 0.7, y: 0, width: 0.3, height: 0.4})
  const wider = resizeCrop(crop, 'e', 0.2, 0)
  expect(wider.width).toBeCloseTo(0.5)
  expect(resizeCrop(crop, 'w', -0.5, 0).x).toBe(0)
  const locked = resizeCrop(crop, 'se', 0.3, 0, 1)
  expect(locked.width).toBeCloseTo(0.6)
  expect(locked.height).toBeCloseTo(0.6)
  const bounded = resizeCrop(crop, 'se', 2, 2, 1)
  expect(bounded.width).toBeCloseTo(0.8)
  expect(bounded.y + bounded.height).toBeCloseTo(1)
})
