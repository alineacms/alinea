import {File} from '@alinea/iso'
import {base64} from 'alinea/core/util/Encoding'
import {rgba, toHex} from 'color2k'
import {rgbaToThumbHash, thumbHashToAverageRGBA} from 'thumbhash'

export interface ImagePreviewDetails {
  width: number
  height: number
  averageColor: string
  focus: {x: number; y: number}
  thumbHash: string
  preview: string
}

export async function createPreview(file: File): Promise<ImagePreviewDetails> {
  const {default: sharp} = await import('sharp').catch(() => {
    throw new Error(
      `To create image previews server side you need to install the 'sharp' package`
    )
  })
  const image = sharp(await file.arrayBuffer())
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  // Scale the image to 100x100 maximum size
  const scaledImage = image.resize(100, 100, {
    fit: 'inside'
  })
  const {data, info} = await scaledImage
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true})
  const thumbHash = rgbaToThumbHash(info.width, info.height, data)

  // Get the average color via thumbhash
  const {r, g, b, a} = thumbHashToAverageRGBA(thumbHash)
  const averageColor = toHex(rgba(r * 255, g * 255, b * 255, a))

  // Create webp preview image
  const previewImage = image.resize(160, 160, {
    fit: 'inside'
  })
  const previewBuffer = await previewImage.webp().toBuffer()
  const preview = `data:image/webp;base64,${previewBuffer.toString('base64')}`

  return {
    width,
    height,
    thumbHash: base64.stringify(thumbHash),
    averageColor,
    preview,
    focus: {x: 0.5, y: 0.5}
  }
}
