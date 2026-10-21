import {suite} from '@alinea/suite'
import {Config, Edit, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import {Config as CoreConfig} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {LocalDB} from '#/database/LocalDB.js'

const test = suite(import.meta)

const Photo = Config.file('Photo', {
  accept: 'image/*',
  fields: {credit: Field.text('Credit')}
})
const Logo = Config.file('Logo', {accept: 'image/*'})
const Download = Config.file('Download', {accept: '.pdf'})
const Folder = Config.type('Folder', {
  contains: ['Folder', 'Photo', 'Logo', 'Download'],
  fields: {}
})
const Logos = Config.type('Logos', {contains: ['Logo'], fields: {}})
const Page = Config.document('Page', {
  fields: {image: Field.image('Image'), file: Field.file('File')}
})

const cms = createCMS({
  schema: {Photo, Logo, Download, Folder, Logos, Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {contains: ['Page']}),
        library: Config.root('Library', {
          contains: ['Folder', 'Logos', 'Photo', 'Download']
        }),
        media: Config.media()
      }
    })
  }
})

class DB extends LocalDB {
  async prepareUpload(file: string): Promise<UploadResponse> {
    return {
      entryId: file,
      location: file,
      previewUrl: '',
      url: `https://uploads.alinea.test/${file}`
    }
  }
}

async function withUploads<T>(run: (db: DB) => Promise<T>): Promise<T> {
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  try {
    const db = new DB(cms.config)
    await db.sync()
    return await run(db)
  } finally {
    globalThis.fetch = fetch
  }
}

const file = (name: string) => new File(['contents'], name)

test('a location takes the file types it contains', () => {
  const location = {workspace: 'main', root: 'library'}
  test.equal(CoreConfig.uploadTypes(cms.config, location), [
    'Photo',
    'Download'
  ])
  test.equal(
    CoreConfig.uploadTypes(cms.config, {...location, parentType: 'Folder'}),
    ['Photo', 'Logo', 'Download']
  )
  test.equal(
    CoreConfig.uploadTypes(cms.config, {workspace: 'main', root: 'media'}),
    ['MediaFile']
  )
  test.equal(
    CoreConfig.uploadTypes(cms.config, {workspace: 'main', root: 'pages'}),
    []
  )
  test.equal(
    CoreConfig.acceptingTypes(
      cms.config,
      {...location, parentType: 'Folder'},
      'photo.jpg'
    ),
    ['Photo', 'Logo']
  )
})

test('an upload becomes the first file type that accepts it', async () => {
  await withUploads(async db => {
    const photo = await db.upload({file: file('photo.jpg'), root: 'library'})
    const pdf = await db.upload({file: file('terms.pdf'), root: 'library'})
    const types = await db.find({
      id: {in: [photo._id, pdf._id]},
      select: {id: Entry.id, type: Entry.type}
    })
    test.equal(types.map(row => row.type).sort(), ['Download', 'Photo'])
  })
})

test('an upload can pick one of the file types that accept it', async () => {
  await withUploads(async db => {
    const folder = await db.create({
      type: Folder,
      root: 'library',
      set: {title: 'Brand', path: 'brand'}
    })
    const logo = await db.upload({
      file: file('logo.png'),
      root: 'library',
      parentId: folder._id,
      type: 'Logo'
    })
    test.is(await db.first({id: logo._id, select: Entry.type}), 'Logo')
    await test.throws(
      () =>
        db.upload({
          file: file('logo.png'),
          root: 'library',
          parentId: folder._id,
          type: 'Download'
        }),
      '"Download" does not accept logo.png'
    )
  })
})

test('an upload that no file type accepts fails', async () => {
  await withUploads(async db => {
    await test.throws(
      () => db.upload({file: file('export.zip'), root: 'library'}),
      'No file type here accepts export.zip'
    )
    await test.throws(
      () => db.upload({file: file('photo.jpg'), root: 'pages'}),
      "Files can't be uploaded"
    )
  })
})

test('files of every file type can be linked as images and files', async () => {
  await withUploads(async db => {
    const photo = await db.upload({file: file('photo.jpg'), root: 'library'})
    const pdf = await db.upload({file: file('terms.pdf'), root: 'library'})
    const page = await db.create({
      type: Page,
      root: 'pages',
      set: {
        title: 'Page',
        image: Edit.link(Page.image).addImage(photo._id).value(),
        file: Edit.link(Page.file).addFile(pdf._id).value()
      }
    })
    test.is(page.image.extension, '.jpg')
    test.is(page.file.extension, '.pdf')
    test.ok(CoreConfig.fileCondition(cms.config, 'file'))
  })
})
