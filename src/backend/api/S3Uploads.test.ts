import {suite} from '@alinea/suite'
import {presignS3Url, S3Uploads} from './S3Uploads.js'

const test = suite(import.meta)

test('prepares S3 upload and public preview urls', async () => {
  const uploads = new S3Uploads({
    bucket: 'assets',
    region: 'eu-west-1',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    publicUrl: 'https://cdn.example.com/media',
    prefix: 'uploads'
  })

  const prepared = await uploads.prepareUpload('media/My File.JPG', {
    size: 123
  })
  const uploadUrl = new URL(prepared.url)

  test.is(prepared.method, 'PUT')
  test.is(prepared.location.startsWith('media/my-file.'), true)
  test.is(prepared.location.endsWith('.jpg'), true)
  test.is(
    prepared.previewUrl,
    `https://cdn.example.com/media/uploads/${prepared.location}`
  )
  test.is(uploadUrl.hostname, 'assets.s3.eu-west-1.amazonaws.com')
  test.is(uploadUrl.pathname.startsWith('/uploads/media/my-file.'), true)
  test.is(
    uploadUrl.searchParams.get('X-Amz-SignedHeaders'),
    'content-length;host'
  )
})

test('creates a signed preview for private buckets', async () => {
  const uploads = new S3Uploads({
    bucket: 'assets',
    region: 'eu-west-1',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    previewExpiresIn: 3600
  })
  const prepared = await uploads.prepareUpload('media/file.jpg', {size: 12})
  const previewUrl = new URL(prepared.previewUrl)

  test.is(previewUrl.searchParams.get('X-Amz-Expires'), '3600')
  test.is(previewUrl.searchParams.get('X-Amz-SignedHeaders'), 'host')
  test.ok(previewUrl.searchParams.get('X-Amz-Signature'))
})

test('supports path-style endpoints and temporary credentials', async () => {
  const uploads = new S3Uploads({
    bucket: 'assets',
    region: 'auto',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    sessionToken: 'session/token',
    endpoint: 'https://storage.example.com/s3',
    prefix: 'uploads',
    publicUrl: 'https://cdn.example.com'
  })
  const prepared = await uploads.prepareUpload('media/file.jpg', {size: 12})
  const uploadUrl = new URL(prepared.url)

  test.ok(uploadUrl.pathname.startsWith('/s3/assets/uploads/media/file.'))
  test.is(uploadUrl.searchParams.get('X-Amz-Security-Token'), 'session/token')
})

test('matches the AWS SigV4 presigned URL example', async () => {
  const url = await presignS3Url({
    method: 'GET',
    url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    expiresIn: 86400,
    now: new Date('2013-05-24T00:00:00Z')
  })

  test.is(
    new URL(url).searchParams.get('X-Amz-Signature'),
    'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
  )
})

test('rejects upload paths which escape the staging prefix', async () => {
  const uploads = new S3Uploads({
    bucket: 'assets',
    region: 'eu-west-1',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    prefix: 'uploads'
  })

  await test.throws(
    () => uploads.prepareUpload('../../outside.jpg', {size: 1}),
    'path traversal is not allowed'
  )
})

test('requires and limits the signed upload size', async () => {
  const uploads = new S3Uploads(
    {
      bucket: 'assets',
      region: 'eu-west-1',
      accessKeyId: 'access',
      secretAccessKey: 'secret'
    },
    3
  )

  await test.throws(
    () => uploads.prepareUpload('missing.jpg'),
    'Missing or invalid upload size'
  )
  await test.throws(
    () => uploads.prepareUpload('large.jpg', {size: 4}),
    'exceeds the configured limit'
  )
})
