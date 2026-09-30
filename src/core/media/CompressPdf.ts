import type {ImageResizeOptions, ImageTransform} from './ImageTransform.js'

type TransformImage = (
  blob: Blob,
  fileName: string,
  transform: ImageTransform
) => Promise<Blob>

/**
 * Scale down the jpeg images of a PDF with transformImage. Returns the
 * original unless that makes it at least 10% smaller, and for PDFs that can
 * not be rewritten as they are: encrypted, signed or PDF/A documents.
 */
export async function compressPdf(
  blob: Blob,
  resize: ImageResizeOptions | undefined,
  transformImage: TransformImage
): Promise<Blob> {
  if (!resize) return blob
  try {
    const {PDFDocument, PDFDict, PDFName, PDFRawStream} =
      await import('@cantoo/pdf-lib')
    const name = PDFName.of
    const pdf = await PDFDocument.load(await blob.arrayBuffer(), {
      updateMetadata: false
    })
    if (pdf.catalog.has(name('OutputIntents'))) return blob
    const objects = pdf.context.enumerateIndirectObjects()
    const signed = objects.some(
      ([, object]) => object instanceof PDFDict && object.has(name('ByteRange'))
    )
    if (signed) return blob
    let changed = false
    for (const [, stream] of objects) {
      if (!(stream instanceof PDFRawStream)) continue
      const {dict} = stream
      const colorSpace = dict.get(name('ColorSpace'))
      const components =
        colorSpace === name('DeviceRGB')
          ? 3
          : colorSpace === name('DeviceGray')
            ? 1
            : 0
      const plain =
        components > 0 &&
        dict.get(name('Subtype')) === name('Image') &&
        dict.get(name('Filter')) === name('DCTDecode') &&
        !['SMask', 'Mask', 'ImageMask', 'Decode'].some(key =>
          dict.has(name(key))
        )
      if (!plain) continue
      const input = jpegInfo(stream.contents)
      // Viewers ignore the exif orientation that transformImage applies
      if (input?.components !== components || input.exif) continue
      const jpeg = new Blob([stream.contents as BlobPart], {type: 'image/jpeg'})
      const scaled = await transformImage(jpeg, 'image.jpg', {resize})
      if (scaled.size >= jpeg.size) continue
      const contents = new Uint8Array(await scaled.arrayBuffer())
      const output = jpegInfo(contents)
      if (!output || (output.components !== 1 && output.components !== 3))
        continue
      stream.updateContents(contents)
      dict.set(name('Width'), pdf.context.obj(output.width))
      dict.set(name('Height'), pdf.context.obj(output.height))
      dict.set(
        name('ColorSpace'),
        name(output.components === 1 ? 'DeviceGray' : 'DeviceRGB')
      )
      dict.delete(name('DecodeParms'))
      changed = true
    }
    if (!changed) return blob
    const bytes = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false
    })
    if (bytes.byteLength > blob.size * 0.9) return blob
    return new Blob([bytes as BlobPart], {type: 'application/pdf'})
  } catch {
    return blob
  }
}

/** The dimensions and color components of a jpeg, read from its frame */
function jpegInfo(bytes: Uint8Array) {
  let exif = false
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xff) return undefined
    const marker = bytes[at + 1]
    if (marker === 0xe1 && bytes[at + 4] === 0x45 && bytes[at + 5] === 0x78)
      exif = true
    // Start of frame markers, others in this range define tables
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    )
      return {
        height: (bytes[at + 5] << 8) | bytes[at + 6],
        width: (bytes[at + 7] << 8) | bytes[at + 8],
        components: bytes[at + 9],
        exif
      }
    at += 2 + ((bytes[at + 2] << 8) | bytes[at + 3])
  }
  return undefined
}
