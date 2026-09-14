import {suite} from '@alinea/suite'
import {SupabaseUploads, type SupabaseBucketLike} from './SupabaseUploads.js'

const test = suite(import.meta)

test('prepares Supabase upload and public preview urls', async () => {
  const calls: Array<string> = []
  const bucket: SupabaseBucketLike = {
    async createSignedUploadUrl(path) {
      calls.push(`upload:${path}`)
      return {
        data: {signedUrl: `https://storage.example.com/upload/${path}`},
        error: null
      }
    },
    getPublicUrl(path) {
      calls.push(`preview:${path}`)
      return {data: {publicUrl: `https://storage.example.com/public/${path}`}}
    }
  }
  const uploads = new SupabaseUploads(bucket, {prefix: 'uploads'}, 100)

  const prepared = await uploads.prepareUpload('media/My File.JPG', {
    size: 12
  })

  test.is(prepared.method, 'PUT')
  test.ok(prepared.url.startsWith('https://storage.example.com/upload/'))
  test.ok(prepared.previewUrl.startsWith('https://storage.example.com/public/'))
  test.is(calls.length, 2)
  test.ok(calls[0].startsWith('upload:uploads/media/my-file.'))
  test.ok(calls[1].startsWith('preview:uploads/media/my-file.'))
})

test('surfaces Supabase errors', async () => {
  const error = new Error('Could not sign upload')
  const bucket: SupabaseBucketLike = {
    async createSignedUploadUrl() {
      return {data: null, error}
    },
    getPublicUrl() {
      return {data: {publicUrl: 'public'}}
    }
  }
  const uploads = new SupabaseUploads(bucket)

  await test.throws(
    () => uploads.prepareUpload('file.jpg', {size: 1}),
    'Could not sign upload'
  )
})
