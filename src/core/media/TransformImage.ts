import {compressPdf} from './CompressPdf.js'
import {
  imageEncodingType,
  imageTransformPlan,
  isPdf,
  type ImageTransform
} from './ImageTransform.js'

export type {ImageTransform}

/**
 * Rotate, crop and scale down an image with sharp on the server, or scale
 * down the images in a PDF. Returns the original when that changes nothing.
 */
export async function transformImage(
  blob: Blob,
  fileName: string,
  transform: ImageTransform
): Promise<Blob> {
  if (isPdf(fileName))
    return compressPdf(blob, transform.resize, transformImage)
  const type = imageEncodingType(fileName)
  if (!type) return blob
  const {default: sharp} = await import(/* @vite-ignore */ 'sharp' + '').catch(
    () => {
      throw new Error(
        `To resize or edit images server side you need to install the 'sharp' package`
      )
    }
  )
  const input = await blob.arrayBuffer()
  const {width = 0, height = 0, orientation = 1} = await sharp(input).metadata()
  // Exif orientations 5 to 8 show the image sideways
  const sideways = orientation >= 5
  const plan = imageTransformPlan(
    sideways ? height : width,
    sideways ? width : height,
    transform
  )
  if (!plan) return blob
  const image = sharp(input)
    .autoOrient()
    .rotate(plan.rotate)
    .extract(plan.region)
    .resize(plan.width, plan.height, {fit: 'fill'})
  const quality = Math.round(plan.quality * 100)
  const output =
    type === 'image/png'
      ? image.png()
      : type === 'image/webp'
        ? image.webp({quality})
        : image.jpeg({quality, mozjpeg: true})
  const buffer: Uint8Array = await output.toBuffer()
  return new Blob([buffer as BlobPart], {type})
}
