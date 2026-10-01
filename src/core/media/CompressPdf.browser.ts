import {smallerPdf} from './Pdf.js'

/**
 * Recompress the images of a pdf in the browser, everything else is copied
 * as is. Returns the original when that does not make it smaller.
 */
export async function compressPdf(blob: Blob): Promise<Blob> {
  return smallerPdf(blob, async () => {
    const {compressPdfBlob} = await import('leanpdf')
    return compressPdfBlob(blob)
  })
}
