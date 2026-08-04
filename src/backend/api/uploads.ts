import type {UploadsApi} from '#/core/Connection.js'
import type {BackendPart} from './CreateBackend.js'
import {S3Uploads, type S3UploadsOptions} from './S3Uploads.js'
import {
  SupabaseUploads,
  type SupabaseBucketLike,
  type SupabaseUploadsOptions
} from './SupabaseUploads.js'

export type {S3UploadsOptions} from './S3Uploads.js'
export type {
  SupabaseBucketLike,
  SupabaseUploadsOptions
} from './SupabaseUploads.js'

export function custom(api: UploadsApi): BackendPart {
  return api
}

export function s3(options: S3UploadsOptions): BackendPart {
  return (_context, config) => new S3Uploads(options, config.maxUploadSize)
}

export function supabase(
  bucket: SupabaseBucketLike,
  options?: SupabaseUploadsOptions
): BackendPart {
  // Supabase enforces hard size limits at bucket level. The Alinea limit is
  // still checked before a signed upload URL is issued.
  return (_context, config) => {
    return new SupabaseUploads(bucket, options, config.maxUploadSize)
  }
}
