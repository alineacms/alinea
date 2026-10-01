import type {ImageCodec} from 'leanpdf'
import {smallerPdf} from './Pdf.js'

/**
 * Recompress the images of a pdf with sharp, everything else is copied as
 * is. Returns the original when that does not make it smaller, or when sharp
 * is not installed: compressing is optional, unlike resizing images.
 */
export async function compressPdf(blob: Blob): Promise<Blob> {
  const loaded = await import(/* @vite-ignore */ 'sharp' + '').catch(
    () => undefined
  )
  if (!loaded) return blob
  const {default: sharp} = loaded
  const codec: ImageCodec = {
    async recompress(input, options) {
      const {data, width, height, components} = input
      const image =
        input.kind === 'jpeg'
          ? sharp(data, {ignoreIcc: true, autoOrient: false, failOn: 'error'})
          : sharp(data, {raw: {width, height, channels: components}})
      const gray = components === 1 && options.preserveGray
      const encoded = await image
        .resize({
          width: options.maxWidth,
          height: options.maxHeight,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toColourspace(gray ? 'b-w' : 'srgb')
        .jpeg({
          quality: Math.max(1, Math.round(options.jpegQuality * 100)),
          mozjpeg: true,
          progressive: false,
          optimiseScans: false
        })
        .toBuffer({resolveWithObject: true})
      return {
        data: new Uint8Array(encoded.data),
        width: encoded.info.width,
        height: encoded.info.height,
        components: encoded.info.channels === 1 ? 1 : 3
      }
    }
  }
  return smallerPdf(blob, async () => {
    const {compressPdfBlob} = await import('leanpdf')
    return compressPdfBlob(blob, {codec})
  })
}
