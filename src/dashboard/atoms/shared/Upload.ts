import {assertUploadSize} from '#/core/media/UploadLimits.js'

export function uploadSizeError(
  file: File,
  maxUploadSize: number | undefined
): string | undefined {
  try {
    assertUploadSize(file.name, file.size, maxUploadSize)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
