import {isRecord} from '../util/Objects.js'

/** Clockwise rotation in quarter turns */
export type ImageRotation = 0 | 90 | 180 | 270

/** A region of an image, as fractions of its (rotated) width and height */
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

/** Scale down uploaded images that are larger than these dimensions */
export interface ImageResizeOptions {
  /** Maximum width in pixels */
  maxWidth?: number
  /** Maximum height in pixels */
  maxHeight?: number
  /** Encoding quality of jpeg and webp images between 0 and 1, defaults to 0.85 */
  quality?: number
}

/** What `transformImage` does to an image: edit it, then scale it down */
export interface ImageTransform {
  edit?: ImageEdit
  resize?: ImageResizeOptions
}

/** Uploads are scaled down to fit these dimensions unless configured */
export const defaultImageResize: ImageResizeOptions = {
  maxWidth: 2560,
  maxHeight: 2560
}

/** The resize options of the config, undefined when resizing is disabled */
export function imageResizeOptions(
  option: ImageResizeOptions | false | undefined
): ImageResizeOptions | undefined {
  if (option === false) return undefined
  return option ?? defaultImageResize
}

const encodings: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

/**
 * The type a jpeg, png or webp image is encoded with once transformed,
 * undefined for other files: vector images, gifs, documents
 */
export function imageEncodingType(fileName: string): string | undefined {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0]
  return extension ? encodings[extension] : undefined
}

/**
 * Whether an upload can be edited and scaled down: a jpeg, png or webp that
 * is not animated, drawing those again would keep only their first frame
 */
export function isTransformableImage(
  fileName: string,
  bytes: Uint8Array
): boolean {
  return imageEncodingType(fileName) !== undefined && !isAnimated(bytes)
}

function isAnimated(bytes: Uint8Array): boolean {
  const ascii = (at: number, length = 4) =>
    String.fromCharCode(...bytes.subarray(at, at + length))
  // Webp: the animation flag of the extended format header
  if (ascii(0) === 'RIFF' && ascii(8) === 'WEBP')
    return ascii(12) === 'VP8X' && (bytes[20] & 0x02) !== 0
  // Png: an animation control chunk before the image data
  if (ascii(1, 3) !== 'PNG') return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let at = 8; at + 8 <= bytes.length; at += 12 + view.getUint32(at)) {
    const chunk = ascii(at + 4)
    if (chunk === 'acTL') return true
    if (chunk === 'IDAT') return false
  }
  return false
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

/** The steps that transform an image, in pixels */
export interface ImageTransformPlan {
  rotate: ImageRotation
  /** Dimensions of the rotated image */
  rotated: {width: number; height: number}
  /** The region of the rotated image to keep */
  region: {left: number; top: number; width: number; height: number}
  /** The dimensions the region is scaled to */
  width: number
  height: number
  quality: number
}

/**
 * How to transform an image with these (upright) dimensions: rotate it, crop
 * it and scale it down. Undefined when that leaves the image as it is.
 */
export function imageTransformPlan(
  width: number,
  height: number,
  {edit, resize}: ImageTransform
): ImageTransformPlan | undefined {
  const rotate = edit?.rotate ?? 0
  const rotated = rotatedSize(width, height, rotate)
  const crop = edit?.crop ?? {x: 0, y: 0, width: 1, height: 1}
  const left = clamp(Math.round(crop.x * rotated.width), 0, rotated.width - 1)
  const top = clamp(Math.round(crop.y * rotated.height), 0, rotated.height - 1)
  const region = {
    left,
    top,
    width: clamp(
      Math.round(crop.width * rotated.width),
      1,
      rotated.width - left
    ),
    height: clamp(
      Math.round(crop.height * rotated.height),
      1,
      rotated.height - top
    )
  }
  const scale = Math.min(
    1,
    (resize?.maxWidth ?? Infinity) / region.width,
    (resize?.maxHeight ?? Infinity) / region.height
  )
  if (!hasImageEdit(edit) && scale >= 1) return undefined
  return {
    rotate,
    rotated,
    region,
    width: Math.max(1, Math.round(region.width * scale)),
    height: Math.max(1, Math.round(region.height * scale)),
    quality: resize?.quality ?? 0.85
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
