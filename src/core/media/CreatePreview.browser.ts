import {rgba, toHex} from 'color2k'
import smartcrop from 'smartcrop'
import {rgbaToThumbHash, thumbHashToAverageRGBA} from 'thumbhash'
import {base64} from '../util/Encoding.js'
import type {ImagePreviewDetails} from './CreatePreview.js'
import {startsAsPdf} from './Pdf.js'

export type {ImagePreviewDetails}

/** Pixels the first page of a pdf is rendered to fit for its preview */
const pdfPageSize = 320

/**
 * The preview of an image, or of the first page of a pdf. Undefined for a
 * pdf that can not be rendered, such as an encrypted one.
 */
export async function createPreview(
  blob: Blob
): Promise<ImagePreviewDetails | undefined> {
  if (!(await startsAsPdf(blob))) return imagePreview(blob)
  const page = await renderFirstPage(blob).catch(() => undefined)
  return page && imagePreview(page)
}

async function renderFirstPage(blob: Blob): Promise<Blob> {
  const {openPdf, renderPage} = await import('leanpdf')
  const canvas = new OffscreenCanvas(1, 1)
  await renderPage(await openPdf(blob), 0, canvas, {
    width: pdfPageSize,
    height: pdfPageSize
  })
  return canvas.convertToBlob()
}

async function imagePreview(blob: Blob): Promise<ImagePreviewDetails> {
  const url = URL.createObjectURL(blob)

  // Load the image
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = err => reject(err)
    image.src = url
  }).finally(() => URL.revokeObjectURL(url))

  const size = Math.max(image.width, image.height)

  // Scale the image to 100x100 maximum size
  const thumbW = Math.round((100 * image.width) / size)
  const thumbH = Math.round((100 * image.height) / size)
  const thumbCanvas = document.createElement('canvas')
  const thumbContext = thumbCanvas.getContext('2d')!
  thumbCanvas.width = thumbW
  thumbCanvas.height = thumbH
  thumbContext.drawImage(image, 0, 0, thumbW, thumbH)

  // Calculate thumbhash
  const pixels = thumbContext.getImageData(0, 0, thumbW, thumbH)
  const thumbHash = rgbaToThumbHash(thumbW, thumbH, pixels.data)

  // Get the average color via thumbhash
  const {r, g, b} = thumbHashToAverageRGBA(thumbHash)
  const averageColor = toHex(rgba(r * 255, g * 255, b * 255, 1))

  // Create webp preview image
  const previewW = Math.min(Math.round((160 * image.width) / size), image.width)
  const previewH = Math.min(
    Math.round((160 * image.height) / size),
    image.height
  )
  const previewCanvas = document.createElement('canvas')
  const previewContext = previewCanvas.getContext('2d')!
  previewContext.imageSmoothingEnabled = true
  previewContext.imageSmoothingQuality = 'high'
  previewCanvas.width = previewW
  previewCanvas.height = previewH
  previewContext.drawImage(image, 0, 0, previewW, previewH)
  const preview = previewCanvas.toDataURL('image/webp')

  const crop = await smartcrop.crop(image, {width: 100, height: 100})
  const focus = {
    x: (crop.topCrop.x + crop.topCrop.width / 2) / image.width,
    y: (crop.topCrop.y + crop.topCrop.height / 2) / image.height
  }

  return {
    preview,
    averageColor,
    focus,
    thumbHash: base64.stringify(thumbHash),
    width: image.naturalWidth,
    height: image.naturalHeight
  }
}
