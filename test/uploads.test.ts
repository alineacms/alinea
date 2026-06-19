import fs from 'node:fs'
import {suite} from '@alinea/suite'
import {Config, Edit, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import type {UploadResponse} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {createPreview} from '#/core/media/CreatePreview.js'

const test = suite(import.meta)
const Page = Config.document('Page', {
  fields: {
    image: Field.image('Example image')
  }
})

const example = new File(
  [fs.readFileSync('test/fixtures/example.jpg')],
  'example.jpg'
)

class DB extends LocalDB {
  uploads = 0

  async prepareUpload(file: string): Promise<UploadResponse> {
    const id = `upload-${++this.uploads}`
    return {
      entryId: id,
      location: `${file}_${id}`,
      previewUrl: '',
      url: `https://uploads.alinea.test/${file}_${id}`
    }
  }
}

function cmsWithMediaDir(mediaDir?: string, mediaUrl?: string) {
  const main = Config.workspace('Main', {
    source: 'content',
    mediaDir,
    mediaUrl,
    roots: {
      pages: Config.root('Pages', {contains: [Page]}),
      media: Config.media()
    }
  })
  return createCMS({
    schema: {Page},
    workspaces: {main}
  })
}

async function queryUploadedImageSrc(mediaDir?: string, mediaUrl?: string) {
  const fetch = globalThis.fetch
  const uploadFetch: typeof fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  globalThis.fetch = uploadFetch
  const cms = cmsWithMediaDir(mediaDir, mediaUrl)
  const db = new DB(cms.config)
  try {
    const upload = await db.upload({
      file: example,
      createPreview
    })
    const page = await db.create({
      type: Page,
      set: {
        title: 'Page 1',
        image: Edit.link(Page.image).addImage(upload._id).value()
      }
    })
    return page.image.src
  } finally {
    globalThis.fetch = fetch
  }
}

test('upload urls', async () => {
  const src = await queryUploadedImageSrc()
  test.is(src, 'example.jpg_upload-1')
})

test('upload urls keep default public mediaDir out of image URLs', async () => {
  const src = await queryUploadedImageSrc('/public')
  test.is(src, '/example.jpg_upload-1')
})

test('upload urls keep nested mediaDir out of image URLs by default', async () => {
  const src = await queryUploadedImageSrc('/public/media')
  test.is(src, '/example.jpg_upload-1')
})

test('upload urls use configured mediaUrl', async () => {
  const src = await queryUploadedImageSrc('/assets/uploads', '/media')
  test.is(src, '/media/example.jpg_upload-1')
})
