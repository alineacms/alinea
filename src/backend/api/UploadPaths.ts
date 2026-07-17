import type {UploadMetadata} from '#/core/Connection.js'
import {ErrorCode, HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {basename, dirname, extname, join, normalize} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'

export function createUploadLocation(file: string): {
  entryId: string
  location: string
} {
  const entryId = createId()
  const normalized = safeRelativePath(file, 'upload path')
  const directory = dirname(normalized)
  const extension = extname(normalized)
  const base = basename(normalized, extension)
  const filename = [
    slugify(base) || 'file',
    entryId,
    slugify(extension) || 'bin'
  ].join('.')
  return {
    entryId,
    location: join(directory === '.' ? undefined : directory, filename)
  }
}

export function createUploadKey(
  prefix: string | undefined,
  location: string
): string {
  const safePrefix = prefix && safeRelativePath(prefix, 'upload prefix')
  return join(safePrefix, safeRelativePath(location, 'upload location'))
}

export function requireUploadMetadata(
  file: string,
  metadata: UploadMetadata | undefined,
  maxUploadSize: number | undefined
): UploadMetadata {
  if (!metadata || !Number.isSafeInteger(metadata.size) || metadata.size < 0) {
    throw new HttpError(
      ErrorCode.BadRequest,
      `Missing or invalid upload size for "${file}"`
    )
  }
  assertUploadSize(file, metadata.size, maxUploadSize)
  return metadata
}

function safeRelativePath(path: string, label: string): string {
  const normalized = normalize(path).replace(/^\/+/, '')
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new HttpError(
      ErrorCode.BadRequest,
      `Invalid ${label}: path traversal is not allowed`
    )
  }
  return normalized
}
