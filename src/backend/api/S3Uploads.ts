import type {
  UploadMetadata,
  UploadResponse,
  UploadsApi
} from '#/core/Connection.js'
import {join} from '#/core/util/Paths.js'
import {
  createUploadKey,
  createUploadLocation,
  requireUploadMetadata
} from './UploadPaths.js'

export interface S3UploadsOptions {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  endpoint?: string
  forcePathStyle?: boolean
  prefix?: string
  publicUrl?: string | ((key: string) => string)
  uploadExpiresIn?: number
  previewExpiresIn?: number
}

interface S3PresignOptions {
  method: 'GET' | 'PUT'
  url: URL
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  expiresIn: number
  now?: Date
  headers?: Record<string, string>
}

const encoder = new TextEncoder()
const maxPresignLifetime = 60 * 60 * 24 * 7

export class S3Uploads implements UploadsApi {
  #options: S3UploadsOptions
  #maxUploadSize?: number

  constructor(options: S3UploadsOptions, maxUploadSize?: number) {
    this.#options = options
    this.#maxUploadSize = maxUploadSize
  }

  async prepareUpload(
    file: string,
    input?: UploadMetadata
  ): Promise<UploadResponse> {
    const metadata = requireUploadMetadata(file, input, this.#maxUploadSize)
    const {entryId, location} = createUploadLocation(file)
    const key = createUploadKey(this.#options.prefix, location)
    return {
      entryId,
      location,
      previewUrl: await this.#previewUrl(key),
      url: await this.#presign('PUT', key, this.#uploadExpiresIn(), {
        'content-length': String(metadata.size)
      }),
      method: 'PUT'
    }
  }

  async #previewUrl(key: string): Promise<string> {
    const {publicUrl} = this.#options
    if (typeof publicUrl === 'function') return publicUrl(key)
    if (publicUrl) return joinUrl(publicUrl, key)
    return this.#presign('GET', key, this.#previewExpiresIn())
  }

  #uploadExpiresIn(): number {
    return validLifetime(this.#options.uploadExpiresIn ?? 900)
  }

  #previewExpiresIn(): number {
    return validLifetime(this.#options.previewExpiresIn ?? maxPresignLifetime)
  }

  #presign(
    method: 'GET' | 'PUT',
    key: string,
    expiresIn: number,
    headers?: Record<string, string>
  ): Promise<string> {
    const {accessKeyId, region, secretAccessKey, sessionToken} = this.#options
    return presignS3Url({
      method,
      url: this.#objectUrl(key),
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      expiresIn,
      headers
    })
  }

  #objectUrl(key: string): URL {
    const {bucket, endpoint, forcePathStyle} = this.#options
    const pathStyle = forcePathStyle ?? Boolean(endpoint)
    if (endpoint) {
      const base = new URL(endpoint)
      if (pathStyle) {
        base.pathname = join(base.pathname, bucket, key)
      } else {
        base.hostname = `${bucket}.${base.hostname}`
        base.pathname = join(base.pathname, key)
      }
      return base
    }
    return new URL(
      `https://${bucket}.s3.${this.#options.region}.amazonaws.com/${key
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`
    )
  }
}

export async function presignS3Url(options: S3PresignOptions): Promise<string> {
  const {
    accessKeyId,
    expiresIn,
    method,
    region,
    secretAccessKey,
    sessionToken
  } = options
  const now = options.now ?? new Date()
  const date = amzDate(now)
  const datestamp = date.slice(0, 8)
  const credentialScope = `${datestamp}/${region}/s3/aws4_request`
  const url = new URL(options.url)
  const headers = Object.entries(options.headers ?? {})
    .map(([name, value]) => [name.toLowerCase(), value.trim()] as const)
    .concat([['host', url.host] as const])
    .sort(([a], [b]) => compareAscii(a, b))
  const signedHeaders = headers.map(([name]) => name).join(';')
  const query = url.searchParams
  query.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
  query.set('X-Amz-Credential', `${accessKeyId}/${credentialScope}`)
  query.set('X-Amz-Date', date)
  query.set('X-Amz-Expires', String(validLifetime(expiresIn)))
  query.set('X-Amz-SignedHeaders', signedHeaders)
  if (sessionToken) query.set('X-Amz-Security-Token', sessionToken)

  const canonicalRequest = [
    method,
    canonicalUri(url.pathname),
    canonicalQuery(query),
    `${headers.map(([name, value]) => `${name}:${value}`).join('\n')}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    date,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n')
  const signingKey = await hmac(
    await hmac(
      await hmac(await hmac(`AWS4${secretAccessKey}`, datestamp), region),
      's3'
    ),
    'aws4_request'
  )
  query.set('X-Amz-Signature', hex(await hmac(signingKey, stringToSign)))
  return String(url)
}

function validLifetime(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > maxPresignLifetime) {
    throw new RangeError(
      `S3 signed URL lifetime must be between 1 and ${maxPresignLifetime} seconds`
    )
  }
  return value
}

function joinUrl(base: string, path: string): string {
  const url = new URL(base)
  url.pathname = join(url.pathname, path)
  return String(url)
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function canonicalUri(pathname: string): string {
  return pathname
    .split('/')
    .map(segment => encodeRfc3986(decodeURIComponent(segment)))
    .join('/')
}

function canonicalQuery(query: URLSearchParams): string {
  return [...query.entries()]
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => {
      return compareAscii(aKey, bKey) || compareAscii(aValue, bValue)
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return hex(digest)
}

async function hmac(
  key: string | ArrayBuffer,
  value: string
): Promise<ArrayBuffer> {
  const material = typeof key === 'string' ? encoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    material,
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}
