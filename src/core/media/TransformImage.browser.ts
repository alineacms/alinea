import {
  imageEncodingType,
  imageTransformPlan,
  type ImageTransform
} from './ImageTransform.js'

export type {ImageTransform}

/**
 * Rotate, crop and scale down an image on a canvas in the browser. Returns
 * the original when that changes nothing or the browser cannot encode it.
 */
export async function transformImage(
  blob: Blob,
  fileName: string,
  transform: ImageTransform
): Promise<Blob> {
  const type = imageEncodingType(fileName)
  if (!type) return blob
  // Bitmaps are decoded with their exif orientation applied
  const bitmap = await createImageBitmap(blob)
  try {
    const plan = imageTransformPlan(bitmap.width, bitmap.height, transform)
    if (!plan) return blob
    const {rotate, rotated, region} = plan
    const canvas = document.createElement('canvas')
    canvas.width = plan.width
    canvas.height = plan.height
    const context = canvas.getContext('2d')!
    context.imageSmoothingQuality = 'high'
    // Scale the kept region to the canvas, then draw the image rotated
    // around the center of the rotated frame
    context.scale(plan.width / region.width, plan.height / region.height)
    context.translate(
      rotated.width / 2 - region.left,
      rotated.height / 2 - region.top
    )
    context.rotate((rotate * Math.PI) / 180)
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    const result = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, type, plan.quality)
    )
    // Browsers fall back to png for types they cannot encode
    return result?.type === type ? result : blob
  } finally {
    bitmap.close()
  }
}
