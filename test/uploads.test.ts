import fs from 'node:fs'
import {suite} from '@alinea/suite'
import {Config, Edit, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import type {UploadResponse} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {createPreview} from '#/core/media/CreatePreview.js'
import type {
  MediaUrlMeta,
  MediaUrlResolver
} from '#/core/Workspace.js'

const test = suite(import.meta)
const Page = Config.document('Page', {
  fields: {
    body: Field.richText('Body'),
    file: Field.file('Example file'),
    image: Field.image('Example image')
  }
})

const example = new File(
  [fs.readFileSync('test/fixtures/example.jpg')],
  'example.jpg'
)

class DB extends LocalDB {
  uploads = 0
  preparedFiles: Array<string> = []

  async prepareUpload(file: string): Promise<UploadResponse> {
    this.preparedFiles.push(file)
    const id = `upload-${++this.uploads}`
    return {
      entryId: id,
      location: `${file}_${id}`,
      previewUrl: '',
      url: `https://uploads.alinea.test/${file}_${id}`
    }
  }
}

function cmsWithMediaDir(
  mediaDir?: string,
  mediaUrl?: string | MediaUrlResolver,
  maxUploadSize?: number
) {
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
    workspaces: {main},
    maxUploadSize
  })
}

async function queryUploadedImageSrc(
  mediaDir?: string,
  mediaUrl?: string | MediaUrlResolver
) {
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

async function queryUploadedFileUrls(mediaUrl: MediaUrlResolver) {
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  const cms = cmsWithMediaDir('/public/media', mediaUrl)
  const db = new DB(cms.config)
  try {
    const upload = await db.upload({
      file: new File(['example'], 'example.pdf')
    })
    const page = await db.create({
      type: Page,
      set: {
        title: 'Page 1',
        file: Edit.link(Page.file).addFile(upload._id).value(),
        body: [
          {
            _type: 'paragraph',
            content: [
              {
                _type: 'text',
                text: 'Download',
                marks: [
                  {
                    _type: 'link',
                    _id: 'file-link',
                    _link: 'file',
                    _entry: upload._id
                  }
                ]
              }
            ]
          }
        ]
      }
    })
    return {
      fileHref: page.file.href,
      richText: JSON.stringify(page.body)
    }
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

test('upload urls use configured mediaUrl resolver', async () => {
  let resolved: MediaUrlMeta | undefined
  const src = await queryUploadedImageSrc('/public/media', meta => {
    resolved = meta
    return `/images/${meta.path}${meta.extension}`
  })

  test.is(src, '/images/example.jpg')
  test.equal(resolved, {
    path: 'example',
    parentPaths: [],
    extension: '.jpg',
    location: '/example.jpg_upload-1',
    workspace: 'main',
    root: 'media'
  })
})

test('file urls use configured mediaUrl resolver', async () => {
  const urls = await queryUploadedFileUrls(
    ({path, extension}) => `/files/${path}${extension}`
  )

  test.is(urls.fileHref, '/files/example.pdf')
  test.ok(urls.richText.includes('"href":"/files/example.pdf"'))
})

test('uploads use the mediaDir of the selected workspace', async () => {
  const main = Config.workspace('Main', {
    source: 'content/main',
    mediaDir: 'public/media',
    roots: {
      media: Config.media()
    }
  })
  const secondary = Config.workspace('Secondary', {
    source: 'content/secondary',
    mediaDir: 'public/media/secondary',
    roots: {
      media: Config.media()
    }
  })
  const cms = createCMS({
    schema: {Page},
    workspaces: {main, secondary}
  })
  const db = new DB(cms.config)
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )

  try {
    await db.upload({
      file: example,
      workspace: 'secondary'
    })
  } finally {
    globalThis.fetch = fetch
  }

  test.equal(db.preparedFiles, [
    'public/media/secondary/example.jpg'
  ])
})

test('uploads reject files over maxUploadSize before upload', async () => {
  const cms = cmsWithMediaDir(undefined, undefined, 3)
  const db = new DB(cms.config)

  await test.throws(async () => {
    await db.upload({
      file: new File(['abcd'], 'large.txt')
    })
  }, 'exceeds the configured limit')
  test.is(db.uploads, 0)
})
