import fs from 'node:fs'
import {suite} from '@alinea/suite'
import {Config, Edit, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import {createCMS} from '#/core.js'
import type {UploadResponse} from '#/core/Connection.js'
import {LocalDB} from '#/database/LocalDB.js'
import {createPreview} from '#/core/media/CreatePreview.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {createFileHash} from '#/core/util/ContentHash.js'
import {transformImage} from '#/core/media/TransformImage.js'

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

function cmsWithMediaDir(mediaDir?: string, maxUploadSize?: number) {
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

  test.equal(db.preparedFiles, ['public/media/secondary/example.jpg'])
})

test('media urls are prefixed per workspace mediaUrl', async () => {
  const main = Config.workspace('Main', {
    source: 'content/main',
    mediaDir: 'public/media',
    mediaUrl: 'company-a',
    roots: {
      pages: Config.root('Pages', {contains: [Page]}),
      media: Config.media()
    }
  })
  const secondary = Config.workspace('Secondary', {
    source: 'content/secondary',
    mediaDir: 'public/media/secondary',
    mediaUrl: 'company-b',
    roots: {
      pages: Config.root('Pages', {contains: [Page]}),
      media: Config.media()
    }
  })
  const cms = createCMS({
    schema: {Page},
    workspaces: {main, secondary}
  })
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )

  try {
    const db = new DB(cms.config)
    const upload = await db.upload({file: example, workspace: 'main'})
    const page = await db.create({
      type: Page,
      set: {
        title: 'Page 1',
        image: Edit.link(Page.image).addImage(upload._id).value()
      }
    })
    test.ok(page.image.src.startsWith('/admin/file/company-a/example.jpg'))
    const db2 = new DB(cms.config)
    const upload2 = await db2.upload({file: example, workspace: 'secondary'})
    const page2 = await db2.create({
      type: Page,
      set: {
        title: 'Page 2',
        image: Edit.link(Page.image).addImage(upload2._id).value()
      }
    })
    test.ok(page2.image.src.startsWith('/admin/file/company-b/example.jpg'))
  } finally {
    globalThis.fetch = fetch
  }
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

test('uploads scale down images larger than resizeImages', async () => {
  const fetch = globalThis.fetch
  const uploaded: Array<number> = []
  globalThis.fetch = Object.assign(
    async (_url: unknown, init?: RequestInit) => {
      uploaded.push((init!.body as ArrayBuffer | Uint8Array).byteLength)
      return new Response(null, {status: 204})
    },
    {preconnect: fetch.preconnect}
  )
  const cms = createCMS({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {media: Config.media()}
      })
    },
    resizeImages: {maxWidth: 40, maxHeight: 40},
    // The original is larger, resizing happens before the limit applies
    maxUploadSize: example.size - 1
  })
  const db = new DB(cms.config)
  try {
    const upload = await db.upload({
      file: example,
      createPreview,
      transformImage
    })
    const media = await db.get({
      id: upload._id,
      select: {
        width: MediaFile.width,
        height: MediaFile.height,
        size: MediaFile.size,
        extension: MediaFile.extension,
        hash: MediaFile.hash,
        sourceHash: MediaFile.sourceHash
      }
    })
    test.ok(Math.max(media.width!, media.height!) === 40)
    test.ok(media.size < example.size)
    test.is(media.extension, '.jpg')
    test.equal(uploaded, [media.size])
    // The hash of the original recognizes a second upload of the same file
    test.is(
      media.sourceHash,
      await createFileHash(new Uint8Array(await example.arrayBuffer()))
    )
    test.ok(media.hash !== media.sourceHash)
  } finally {
    globalThis.fetch = fetch
  }
})

test('uploads record who created the file, saves and replaces who updated it', async () => {
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  const jane = {sub: 'jane', name: 'Jane', email: 'jane@example.com'}
  const john = {sub: 'john', name: 'John', email: 'john@example.com'}
  const db = new DB(cmsWithMediaDir().config)
  const metadata = async (id: string) =>
    db.get({id, select: MediaFile.metadata})
  try {
    const upload = await db.upload({
      file: new File(['one'], 'notes.txt'),
      user: jane
    })
    const created = await metadata(upload._id)
    test.equal(created.createdBy, {name: 'Jane', email: 'jane@example.com'})
    test.equal(created.updatedBy, created.createdBy)
    test.ok(typeof created.createdAt === 'number')

    // The dashboard's save of an alt text
    const data = await db.get({id: upload._id, select: Entry.data})
    await db.mutate([
      {
        op: 'create',
        id: upload._id,
        locale: null,
        type: 'MediaFile',
        overwrite: true,
        data: Type.beforeSave(
          MediaFile,
          {...data, alt: 'Notes'},
          {action: 'publish', user: john, now: new Date()}
        )
      }
    ])
    const saved = await metadata(upload._id)
    test.is(saved.createdAt, created.createdAt)
    test.equal(saved.createdBy, created.createdBy)
    test.equal(saved.updatedBy, {name: 'John', email: 'john@example.com'})

    await db.upload({
      file: new File(['two'], 'notes.txt'),
      replaceId: upload._id,
      user: jane
    })
    const replaced = await metadata(upload._id)
    test.is(replaced.createdAt, created.createdAt)
    test.equal(replaced.updatedBy, {name: 'Jane', email: 'jane@example.com'})
    test.is(await db.get({id: upload._id, select: MediaFile.alt}), 'Notes')

    // Files from before audit metadata do not get made up creation details
    const existing = await db.create({
      type: MediaFile,
      root: 'media',
      set: {title: 'Old', location: 'old.txt', extension: '.txt'}
    })
    await db.upload({
      file: new File(['new'], 'old.txt'),
      replaceId: existing._id,
      user: john
    })
    const old = await metadata(existing._id)
    test.is(old.createdAt, undefined)
    test.is(old.createdBy, undefined)
    test.equal(old.updatedBy, {name: 'John', email: 'john@example.com'})
  } finally {
    globalThis.fetch = fetch
  }
})
