import {isRecord} from '../util/Objects.js'

/** Clockwise rotation in quarter turns */
export type ImageRotation = 0 | 90 | 180 | 270

/** A region of an image, relative to its (rotated) width and height */
export interface ImageCrop {
  x: number
  y: number
  width: number
  height: number
}

/** Edits applied to an image before it is uploaded */
export interface ImageEdit {
  /** Rotation applied first */
  rotate?: ImageRotation
  /** The region to keep of the rotated image */
  crop?: ImageCrop
}

/** The pixel region of a crop, clamped to an image of these dimensions */
export interface ImageRegion {
  left: number
  top: number
  width: number
  height: number
}

export function isImageRotation(value: unknown): value is ImageRotation {
  return value === 0 || value === 90 || value === 180 || value === 270
}

export function isImageCrop(value: unknown): value is ImageCrop {
  if (!isRecord(value)) return false
  const {x, y, width, height} = value
  return [x, y, width, height].every(
    n => typeof n === 'number' && n >= 0 && n <= 1
  )
}

/** Whether the edit changes the image */
export function hasImageEdit(edit: ImageEdit | undefined): edit is ImageEdit {
  if (!edit) return false
  if (edit.rotate) return true
  const crop = edit.crop
  return Boolean(
    crop && (crop.x > 0 || crop.y > 0 || crop.width < 1 || crop.height < 1)
  )
}

/** Dimensions of an image once rotated */
export function rotatedSize(
  width: number,
  height: number,
  rotate: ImageRotation = 0
): {width: number; height: number} {
  return rotate % 180 === 0 ? {width, height} : {width: height, height: width}
}

/** The pixels a crop keeps of an image with these (rotated) dimensions */
export function cropRegion(
  crop: ImageCrop | undefined,
  width: number,
  height: number
): ImageRegion {
  if (!crop) return {left: 0, top: 0, width, height}
  const left = clamp(Math.round(crop.x * width), 0, width - 1)
  const top = clamp(Math.round(crop.y * height), 0, height - 1)
  return {
    left,
    top,
    width: clamp(Math.round(crop.width * width), 1, width - left),
    height: clamp(Math.round(crop.height * height), 1, height - top)
  }
}

/** Encoding quality of edited jpeg and webp images */
export const editedImageQuality = 0.92

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
