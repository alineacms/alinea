import fs from 'node:fs'
import {createServer} from 'node:http'
import type {AddressInfo} from 'node:net'
import {suite} from '@alinea/suite'
import {Config, Edit, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import type {UploadResponse} from 'alinea/core/Connection.js'
import {createId} from 'alinea/core/Id'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {createPreview} from 'alinea/core/media/CreatePreview'

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
  [fs.readFileSync('src/test/fixtures/example.jpg')],
  'example.jpg'
)

class DB extends LocalDB {
  async prepareUpload(file: string): Promise<UploadResponse> {
    const serve = await listenForUpload()
    const id = createId()
    return {
      entryId: id,
      location: `media/${file}_${id}`,
      previewUrl: `preview/${file}_${id}`,
      url: serve.url
    }
  }
}

test('upload urls', async () => {
  const db = new DB(cms.config)
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
})

async function listenForUpload(): Promise<{url: string}> {
  const server = createServer((req, res) => {
    res.end()
    server.close()
  })
  return new Promise(resolve => {
    server.listen(0, () => {
      resolve({
        url: `http://localhost:${(<AddressInfo>server.address()).port}`
      })
    })
  })
}
