import fs from 'node:fs'
import {suite} from '@alinea/suite'
import {Config, Edit, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import type {UploadResponse} from '#/core/Connection.js'
import {createId} from '#/core/Id.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {createPreview} from '#/core/media/CreatePreview.js'

const test = suite(import.meta)
const Page = Config.document('Page', {
  fields: {
    image: Field.image('Example image')
  }
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {contains: [Page]}),
    media: Config.media()
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

const example = new File(
  [fs.readFileSync('test/fixtures/example.jpg')],
  'example.jpg'
)

class DB extends LocalDB {
  async prepareUpload(file: string): Promise<UploadResponse> {
    const id = createId()
    return {
      entryId: id,
      location: `media/${file}_${id}`,
      previewUrl: `preview/${file}_${id}`,
      url: `https://uploads.alinea.test/${file}_${id}`
    }
  }
}

test('upload urls', async () => {
  const fetch = globalThis.fetch
  const uploadFetch: typeof fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  globalThis.fetch = uploadFetch
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
    test.is(page.image.src, upload.previewUrl)
  } finally {
    globalThis.fetch = fetch
  }
})
