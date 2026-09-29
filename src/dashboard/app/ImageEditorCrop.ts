import type {ImageCrop} from '#/core/media/ImageEdit.js'

/** Handles on the edges and corners of the crop area */
export type CropHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'

export const fullCrop: ImageCrop = {x: 0, y: 0, width: 1, height: 1}

/** The smallest crop, relative to the image */
const minSize = 0.05

export function isFullCrop(crop: ImageCrop): boolean {
  return crop.x <= 0 && crop.y <= 0 && crop.width >= 1 && crop.height >= 1
}

/** The crop of the same pixels once the image turns a quarter clockwise
 * (1) or counterclockwise (-1) */
export function rotateCrop(crop: ImageCrop, direction: 1 | -1): ImageCrop {
  if (direction === 1)
    return {
      x: 1 - (crop.y + crop.height),
      y: crop.x,
      width: crop.height,
      height: crop.width
    }
  return {
    x: crop.y,
    y: 1 - (crop.x + crop.width),
    width: crop.height,
    height: crop.width
  }
}

/**
 * The largest crop with a ratio (of relative width to relative height)
 * that fits the image, centered on the current crop
 */
export function fitCrop(crop: ImageCrop, ratio: number): ImageCrop {
  let width = 1
  let height = 1 / ratio
  if (height > 1) {
    height = 1
    width = ratio
  }
  const centerX = crop.x + crop.width / 2
  const centerY = crop.y + crop.height / 2
  return {
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height
  }
}

export function moveCrop(crop: ImageCrop, dx: number, dy: number): ImageCrop {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height)
  }
}

/**
 * Drag a handle of the crop. With a ratio the opposite corner stays in
 * place and the crop keeps its ratio.
 */
export function resizeCrop(
  crop: ImageCrop,
  handle: CropHandle,
  dx: number,
  dy: number,
  ratio?: number
): ImageCrop {
  let left = crop.x
  let top = crop.y
  let right = crop.x + crop.width
  let bottom = crop.y + crop.height
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.includes('n')
  const south = handle.includes('s')
  if (ratio && (west || east) && (north || south)) {
    const dragWidth = east ? right + dx - left : right - (left + dx)
    const dragHeight = south ? bottom + dy - top : bottom - (top + dy)
    const maxWidth = east ? 1 - left : right
    const maxHeight = south ? 1 - top : bottom
    const width = clamp(
      Math.max(dragWidth, dragHeight * ratio),
      minSize,
      Math.min(maxWidth, maxHeight * ratio)
    )
    const height = width / ratio
    return {
      x: east ? left : right - width,
      y: south ? top : bottom - height,
      width,
      height
    }
  }
  if (west) left = clamp(left + dx, 0, right - minSize)
  if (east) right = clamp(right + dx, left + minSize, 1)
  if (north) top = clamp(top + dy, 0, bottom - minSize)
  if (south) bottom = clamp(bottom + dy, top + minSize, 1)
  return {x: left, y: top, width: right - left, height: bottom - top}
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
