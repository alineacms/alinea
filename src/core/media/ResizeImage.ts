import {imageResizeTarget, type ImageResizeOptions} from './ImageResize.js'

export type {ImageResizeOptions}

/**
 * Scale down an image larger than the configured dimensions, using sharp on
 * the server. Returns the original when it fits or has no resizable format.
 */
export async function resizeImage(
  blob: Blob,
  fileName: string,
  options: ImageResizeOptions
): Promise<Blob> {
  const {default: sharp} = await import(/* @vite-ignore */ 'sharp' + '').catch(
    () => {
      throw new Error(
        `To resize images server side you need to install the 'sharp' package`
      )
    }
  )
  const input = await blob.arrayBuffer()
  // Apply the exif orientation so width and height match what is shown
  const image = sharp(input).rotate()
  const {width = 0, height = 0, orientation = 1} = await image.metadata()
  const rotated = orientation >= 5
  const target = imageResizeTarget(
    fileName,
    rotated ? height : width,
    rotated ? width : height,
    options
  )
  if (!target) return blob
  const resized = image.resize(target.width, target.height, {fit: 'fill'})
  const quality = Math.round(target.quality * 100)
  const output =
    target.type === 'image/png'
      ? resized.png()
      : target.type === 'image/webp'
        ? resized.webp({quality})
        : resized.jpeg({quality, mozjpeg: true})
  const buffer: Uint8Array = await output.toBuffer()
  return new Blob([buffer as BlobPart], {type: target.type})
}
