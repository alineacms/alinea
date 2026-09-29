import {
  cropRegion,
  editedImageQuality,
  hasImageEdit,
  rotatedSize,
  type ImageEdit
} from './ImageEdit.js'
import {imageEncodingType} from './ImageResize.js'

export type {ImageEdit}

/**
 * Rotate and crop an image on a canvas in the browser. Returns the original
 * when there is nothing to edit or the format cannot be encoded.
 */
export async function editImage(
  blob: Blob,
  fileName: string,
  edit: ImageEdit
): Promise<Blob> {
  const type = imageEncodingType(fileName)
  if (!type || !hasImageEdit(edit)) return blob
  // Bitmaps are decoded with their exif orientation applied
  const bitmap = await createImageBitmap(blob)
  try {
    const rotate = edit.rotate ?? 0
    const rotated = rotatedSize(bitmap.width, bitmap.height, rotate)
    const region = cropRegion(edit.crop, rotated.width, rotated.height)
    const canvas = document.createElement('canvas')
    canvas.width = region.width
    canvas.height = region.height
    const context = canvas.getContext('2d')!
    // Move the crop to the origin, then draw the image rotated around the
    // center of the rotated frame
    context.translate(-region.left, -region.top)
    context.translate(rotated.width / 2, rotated.height / 2)
    context.rotate((rotate * Math.PI) / 180)
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    const edited = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, type, editedImageQuality)
    )
    // Browsers fall back to png for types they cannot encode
    if (!edited || edited.type !== type) return blob
    return edited
  } finally {
    bitmap.close()
  }
}
