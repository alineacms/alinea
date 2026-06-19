import {ErrorCode, HttpError} from '../HttpError.js'
import prettyBytes from 'pretty-bytes'

export function assertUploadSize(
  fileName: string,
  size: number | undefined,
  maxUploadSize: number | undefined
) {
  if (maxUploadSize === undefined || size === undefined) return
  if (size <= maxUploadSize) return
  throw new HttpError(
    ErrorCode.PayloadTooLarge,
    `File "${fileName}" is ${prettyBytes(
      size
    )}, which exceeds the configured limit of ${prettyBytes(maxUploadSize)}`
  )
}
