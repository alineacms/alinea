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

class MultiWorkspaceDB extends LocalDB {
  async prepareUpload(file: string): Promise<UploadResponse> {
    const serve = await listenForUpload()
    return {
      entryId: createId(),
      location: file,
      previewUrl: `preview/${file}`,
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

test('upload stores public location for nested workspace media dirs', async () => {
  const mainWorkspace = Config.workspace('Main', {
    source: 'content/main',
    mediaDir: 'public',
    roots: {
      pages: Config.root('Pages', {contains: [Page]}),
      media: Config.media()
    }
  })
  const regio = Config.workspace('Regio', {
    source: 'content/regio',
    mediaDir: 'public/regio',
    roots: {
      pages: Config.root('Pages', {contains: [Page]}),
      media: Config.media()
    }
  })
  const cms = createCMS({
    schema: {Page},
    workspaces: {main: mainWorkspace, regio}
  })
  const db = new MultiWorkspaceDB(cms.config)

  const uploadRegio= await db.upload({
    file: example,
    workspace: 'regio',
    createPreview
  })
  test.is(uploadRegio.location, '/regio/example.jpg')

  const uploadMain = await db.upload({
    file: example,
    workspace: 'main',
    createPreview
  })
  test.is(uploadMain.location, '/example.jpg')
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
