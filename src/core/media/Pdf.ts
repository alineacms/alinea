import type {CompressReport} from 'leanpdf'
import {isImage} from './IsImage.js'

/** Whether a file name or extension is a pdf */
export function isPdf(pathOrExtension: string): boolean {
  return pathOrExtension.toLowerCase().split('.').pop() === 'pdf'
}

/** Readers accept the header anywhere in the first 1024 bytes */
const pdfHeaderRange = 1024

/** Whether a file starts like a pdf, for blobs that come without a name */
export async function startsAsPdf(blob: Blob): Promise<boolean> {
  const head = await blob.slice(0, pdfHeaderRange).text()
  return head.includes('%PDF-')
}

/** Whether media files of this extension are shown by their preview image */
export function hasPreviewImage(extension: string): boolean {
  return Boolean(isImage(extension)) || isPdf(extension)
}

/**
 * The compressed pdf, or the original when compressing fails, gains nothing
 * or would invalidate its signatures
 */
export async function smallerPdf(
  blob: Blob,
  compress: () => Promise<{blob: Blob; report: CompressReport}>
): Promise<Blob> {
  try {
    const result = await compress()
    if (result.report.signaturesInvalidated) return blob
    if (result.blob.size >= blob.size) return blob
    return new Blob([result.blob], {type: 'application/pdf'})
  } catch {
    return blob
  }
}
