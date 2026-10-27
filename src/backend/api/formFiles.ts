import type {FormFileStorage} from '#/core/Forms.js'
import {type S3UploadsOptions, presignS3Url, s3ObjectUrl} from './S3Uploads.js'

export type {FormFileStorage} from '#/core/Forms.js'

/** How long the handler takes to read, write or remove a file */
const requestLifetime = 60

export interface S3FormFilesOptions extends Pick<
  S3UploadsOptions,
  | 'bucket'
  | 'region'
  | 'accessKeyId'
  | 'secretAccessKey'
  | 'sessionToken'
  | 'endpoint'
  | 'forcePathStyle'
> {
  /** Put before the key of each file, eg. `form-files/` */
  prefix?: string
}

/**
 * Keeps the files visitors upload to forms in an S3 bucket, or one that
 * speaks S3 such as R2. Use a private bucket: the files are only read by the
 * handler, for editors who can read the form.
 */
export function s3(options: S3FormFilesOptions): FormFileStorage {
  async function request(
    method: 'GET' | 'PUT' | 'DELETE',
    key: string,
    init?: RequestInit
  ): Promise<Response> {
    const url = await presignS3Url({
      ...options,
      method,
      url: s3ObjectUrl(options, `${options.prefix ?? ''}${key}`),
      expiresIn: requestLifetime
    })
    return fetch(url, {...init, method})
  }
  return {
    async write(key, content, type) {
      const response = await request('PUT', key, {
        body: new Uint8Array(content),
        headers: {'content-type': type || 'application/octet-stream'}
      })
      if (!response.ok)
        throw new Error(`Could not store ${key}: ${response.status}`)
    },
    async read(key) {
      const response = await request('GET', key)
      if (response.status === 404) return undefined
      if (!response.ok)
        throw new Error(`Could not read ${key}: ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    async remove(keys) {
      await Promise.all(keys.map(key => request('DELETE', key)))
    }
  }
}

interface SupabaseResult<T> {
  data: T | null
  error: unknown
}

/** A bucket of the Supabase client, `supabase.storage.from('form-files')` */
export interface SupabaseFormFilesBucket {
  upload(
    path: string,
    body: Uint8Array,
    options?: {contentType?: string}
  ): PromiseLike<SupabaseResult<unknown>>
  download(path: string): PromiseLike<SupabaseResult<Blob>>
  remove(paths: Array<string>): PromiseLike<SupabaseResult<unknown>>
}

/**
 * Keeps the files visitors upload to forms in a private Supabase Storage
 * bucket, eg. `formFiles.supabase(supabase.storage.from('form-files'))`
 */
export function supabase(bucket: SupabaseFormFilesBucket): FormFileStorage {
  return {
    async write(key, content, type) {
      const {error} = await bucket.upload(key, content, {contentType: type})
      if (error) throw error
    },
    async read(key) {
      const {data} = await bucket.download(key)
      return data ? new Uint8Array(await data.arrayBuffer()) : undefined
    },
    async remove(keys) {
      const {error} = await bucket.remove(keys)
      if (error) throw error
    }
  }
}
