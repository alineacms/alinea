import {imageResizeTarget, type ImageResizeOptions} from './ImageResize.js'

export type {ImageResizeOptions}

/**
 * Scale down an image larger than the configured dimensions on a canvas in
 * the browser. Returns the original when it fits, has no resizable format or
 * the browser cannot encode it.
 */
export async function resizeImage(
  blob: Blob,
  fileName: string,
  options: ImageResizeOptions
): Promise<Blob> {
  // Bitmaps are decoded with their exif orientation applied
  const bitmap = await createImageBitmap(blob)
  try {
    const target = imageResizeTarget(
      fileName,
      bitmap.width,
      bitmap.height,
      options
    )
    if (!target) return blob
    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')!
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, target.width, target.height)
    const resized = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, target.type, target.quality)
    )
    // Browsers fall back to png for types they cannot encode
    if (!resized || resized.type !== target.type) return blob
    return resized
  } finally {
    bitmap.close()
  }
}
