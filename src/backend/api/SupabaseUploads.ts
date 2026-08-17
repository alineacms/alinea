import type {
  UploadMetadata,
  UploadResponse,
  UploadsApi
} from '#/core/Connection.js'
import {
  createUploadKey,
  createUploadLocation,
  requireUploadMetadata
} from './UploadPaths.js'

interface SupabaseResult<T> {
  data: T | null
  error: unknown
}

export interface SupabaseBucketLike {
  createSignedUploadUrl(
    path: string,
    options?: {upsert?: boolean}
  ): PromiseLike<
    SupabaseResult<{path?: string; signedUrl: string; token?: string}>
  >
  getPublicUrl(path: string): {data: {publicUrl: string}}
}

export interface SupabaseUploadsOptions {
  prefix?: string
}

export class SupabaseUploads implements UploadsApi {
  #bucket: SupabaseBucketLike
  #options: SupabaseUploadsOptions
  #maxUploadSize?: number

  constructor(
    bucket: SupabaseBucketLike,
    options: SupabaseUploadsOptions = {},
    maxUploadSize?: number
  ) {
    this.#bucket = bucket
    this.#options = options
    this.#maxUploadSize = maxUploadSize
  }

  async prepareUpload(
    file: string,
    input?: UploadMetadata
  ): Promise<UploadResponse> {
    requireUploadMetadata(file, input, this.#maxUploadSize)
    const {entryId, location} = createUploadLocation(file)
    const key = createUploadKey(this.#options.prefix, location)
    const upload = await this.#bucket.createSignedUploadUrl(key)
    return {
      entryId,
      location,
      previewUrl: this.#bucket.getPublicUrl(key).data.publicUrl,
      url: result(upload).signedUrl,
      method: 'PUT'
    }
  }
}

function result<T>(response: SupabaseResult<T>): T {
  if (response.error) {
    throw response.error instanceof Error
      ? response.error
      : new Error(String(response.error))
  }
  if (!response.data) throw new Error('Supabase Storage returned no data')
  return response.data
}
