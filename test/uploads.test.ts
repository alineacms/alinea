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
  maxUploadSize?: number
) {
  const main = Config.workspace('Main', {
    source: 'content',
    mediaDir,
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

async function queryUploadedImageSrc(mediaDir?: string) {
  const fetch = globalThis.fetch
  const uploadFetch: typeof fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  globalThis.fetch = uploadFetch
  const cms = cmsWithMediaDir(mediaDir)
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

async function queryUploadedFileUrls() {
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  const cms = cmsWithMediaDir('/public/media')
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
  test.is(src, '/admin/file/example.jpg?v=c5d972d9')
})

test('upload urls do not expose the public mediaDir', async () => {
  const src = await queryUploadedImageSrc('/public')
  test.is(src, '/admin/file/example.jpg?v=c5d972d9')
})

test('upload urls do not expose a nested mediaDir', async () => {
  const src = await queryUploadedImageSrc('/public/media')
  test.is(src, '/admin/file/example.jpg?v=c5d972d9')
})

test('file urls use the Alinea file route', async () => {
  const urls = await queryUploadedFileUrls()

  test.is(urls.fileHref, '/admin/file/example.pdf')
  test.ok(urls.richText.includes('"href":"/admin/file/example.pdf"'))
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

test('uploads normalize only the filename extension', async () => {
  const cases = [
    {
      fileName: 'photo.jpg',
      title: 'photo',
      path: 'photo.jpg',
      extension: '.jpg'
    },
    {
      fileName: 'Photo.JPG',
      title: 'Photo',
      path: 'photo.jpg',
      extension: '.jpg'
    },
    {
      fileName: 'Logo.PnG',
      title: 'Logo',
      path: 'logo.png',
      extension: '.png'
    },
    {
      fileName: 'Researcher.Photo.JPG',
      title: 'Researcher.Photo',
      path: 'researcher-photo.jpg',
      extension: '.jpg'
    },
    {
      fileName: 'README',
      title: 'README',
      path: 'readme',
      extension: ''
    }
  ]
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )

  try {
    for (const expected of cases) {
      const db = new DB(cmsWithMediaDir().config)
      const upload = await db.upload({
        file: new File(['example'], expected.fileName)
      })

      test.equal(db.preparedFiles, [expected.path])
      test.is(upload.location, `${expected.path}_upload-1`)
      test.is(upload.title, expected.title)
      test.is(upload.extension, expected.extension)
    }
  } finally {
    globalThis.fetch = fetch
  }
})

test('uploads reject files over maxUploadSize before upload', async () => {
  const cms = cmsWithMediaDir(undefined, 3)
  const db = new DB(cms.config)

  await test.throws(async () => {
    await db.upload({
      file: new File(['abcd'], 'large.txt')
    })
  }, 'exceeds the configured limit')
  test.is(db.uploads, 0)
})
