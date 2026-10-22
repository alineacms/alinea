import {suite} from '@alinea/suite'
import {Config, Edit, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import {Config as CoreConfig} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {getType} from '#/core/Internal.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Root} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {rootAcceptsType} from '#/dashboard/atoms/move.js'
import {LocalDB} from '#/database/LocalDB.js'

const test = suite(import.meta)

const Photo = Config.file('Photo', {
  accept: 'image/*',
  fields: {credit: Field.text('Credit')}
})
const Logo = Config.file('Logo', {accept: 'image/*'})
const Download = Config.file('Download', {
  accept: '.pdf',
  fields: {listed: Field.check('Listed', {initialValue: true})}
})
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
        media: Config.media(),
        assets: Config.media({contains: ['MediaLibrary', 'Photo']})
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

test('media roots and their folders take their own file types first', () => {
  const assets = {workspace: 'main', root: 'assets'}
  test.equal(CoreConfig.uploadTypes(cms.config, assets), ['Photo', 'MediaFile'])
  test.equal(
    CoreConfig.uploadTypes(cms.config, {...assets, parentType: 'MediaLibrary'}),
    ['Photo', 'MediaFile']
  )
})

test('an upload has the initial values of its file type', async () => {
  await withUploads(async db => {
    const pdf = await db.upload({file: file('terms.pdf'), root: 'library'})
    test.is(await db.first({id: pdf._id, select: Download.listed}), true)
  })
})

test('a replaced file keeps a file type that accepts it', async () => {
  await withUploads(async db => {
    const photo = await db.upload({file: file('photo.jpg'), root: 'library'})
    await test.throws(
      () =>
        db.upload({
          file: file('terms.pdf'),
          root: 'library',
          replaceId: photo._id
        }),
      '"Photo" does not accept terms.pdf'
    )
  })
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

test('an upload that no file type here accepts fails', async () => {
  await withUploads(async db => {
    await test.throws(
      () => db.upload({file: file('export.zip'), root: 'library'}),
      'No file type here accepts export.zip'
    )
    // A location without file types takes media files, as before
    const media = await db.upload({file: file('photo.jpg'), root: 'pages'})
    test.is(await db.first({id: media._id, select: Entry.type}), 'MediaFile')
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

test('files upload into a draft folder', async () => {
  await withUploads(async db => {
    const folder = await db.create({
      type: Folder,
      root: 'library',
      status: 'draft',
      set: {title: 'Drafts', path: 'drafts'}
    })
    const photo = await db.upload({
      file: file('photo.jpg'),
      root: 'library',
      parentId: folder._id
    })
    test.is(photo._parentId, folder._id)
  })
})

const AnalyticsMediaFile = Config.mediaFile({
  tabs: {
    analytics: Field.tab('Analytics', {fields: {views: Field.number('Views')}})
  }
})

const mediaCms = createCMS({
  schema: {MediaFile: AnalyticsMediaFile},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {media: Config.media()}
    })
  }
})

test('the schema can define MediaFile with tabs of its own', () => {
  test.is(mediaCms.config.schema.MediaFile, AnalyticsMediaFile)
  test.throws(
    () =>
      createCMS({
        schema: {MediaFile: Config.file('Media file')},
        workspaces: {
          main: Config.workspace('Main', {
            source: 'content',
            roots: {media: Config.media()}
          })
        }
      }),
    '"MediaFile" is a reserved Type name, create it with Config.mediaFile'
  )
  test.throws(
    () =>
      createCMS({
        schema: {Asset: Config.mediaFile()},
        workspaces: {
          main: Config.workspace('Main', {
            source: 'content',
            roots: {media: Config.media()}
          })
        }
      }),
    'Type "Asset" is created with Config.mediaFile, name it "MediaFile"'
  )
  test.throws(
    () => Config.mediaFile({fields: {location: Field.text('Location')}}),
    'Field "location" is defined twice in Type "Media file"'
  )
})

test('the built-in MediaFile is known as the MediaFile of the schema', () => {
  const {config} = mediaCms
  const media = mediaCms.workspaces.main.media
  test.is(Schema.typeNames(config.schema).get(MediaFile), 'MediaFile')
  test.ok(CoreConfig.rootContains(config, media, MediaFile))
  test.ok(CoreConfig.rootContains(config, media, AnalyticsMediaFile))
  test.ok(rootAcceptsType(config, Root.data(media), 'MediaFile'))
  // Types can list the built-in MediaFile in what they contain
  const Gallery = Config.type('Gallery', {contains: [MediaFile], fields: {}})
  test.equal(Schema.contained(config.schema, getType(Gallery).contains!), [
    'MediaFile'
  ])
})

test('queries naming MediaFile find the MediaFile of the schema', async () => {
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async () => new Response(null, {status: 204}),
    {preconnect: fetch.preconnect}
  )
  try {
    const db = new DB(mediaCms.config)
    await db.sync()
    const upload = await db.upload({file: file('photo.jpg')})
    await db.update({
      type: AnalyticsMediaFile,
      id: upload._id,
      set: {views: 3}
    })
    test.equal(
      await db.first({
        type: MediaFile,
        id: upload._id,
        select: {
          type: Entry.type,
          extension: MediaFile.extension,
          views: AnalyticsMediaFile.views
        }
      }),
      {type: 'MediaFile', extension: '.jpg', views: 3}
    )
  } finally {
    globalThis.fetch = fetch
  }
})
