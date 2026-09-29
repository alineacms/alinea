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
 * Rotate and crop an image with sharp on the server. Returns the original
 * when there is nothing to edit or the format cannot be encoded.
 */
export async function editImage(
  blob: Blob,
  fileName: string,
  edit: ImageEdit
): Promise<Blob> {
  const type = imageEncodingType(fileName)
  if (!type || !hasImageEdit(edit)) return blob
  const {default: sharp} = await import(/* @vite-ignore */ 'sharp' + '').catch(
    () => {
      throw new Error(
        `To edit images server side you need to install the 'sharp' package`
      )
    }
  )
  const input = await blob.arrayBuffer()
  const {width = 0, height = 0, orientation = 1} = await sharp(input).metadata()
  // Dimensions as displayed, with the exif orientation applied
  const upright = rotatedSize(width, height, orientation >= 5 ? 90 : 0)
  const rotate = edit.rotate ?? 0
  const rotated = rotatedSize(upright.width, upright.height, rotate)
  const region = cropRegion(edit.crop, rotated.width, rotated.height)
  // Rotating twice in one pipeline is not supported, apply the exif
  // orientation in a first pass
  const oriented = await sharp(input).rotate().toBuffer()
  const image = sharp(oriented).rotate(rotate).extract(region)
  const quality = Math.round(editedImageQuality * 100)
  const output =
    type === 'image/png'
      ? image.png()
      : type === 'image/webp'
        ? image.webp({quality})
        : image.jpeg({quality, mozjpeg: true})
  const buffer: Uint8Array = await output.toBuffer()
  return new Blob([buffer as BlobPart], {type})
}
