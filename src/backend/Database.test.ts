import {Entry} from 'alinea/core'
import * as Edit from 'alinea/core/Edit'
import {EntryPhase} from 'alinea/core/EntryRow'
import {Query} from 'alinea/core/Query'
import {ElementNode, Node, TextNode} from 'alinea/core/TextDoc'
import {createPreview} from 'alinea/core/media/CreatePreview'
import {readFileSync} from 'fs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createExample} from './test/Example.js'

test('create', async () => {
  const example = createExample()
  const {Page} = example.schema
  const parent = Edit.create(Page).set({title: 'New parent'})
  await example.commit(parent)
  const result = await example.get({
    select: Entry,
    filter: {_id: parent.entryId}
  })
  assert.is(result.entryId, parent.entryId)
  assert.is(result.title, 'New parent')
})

test('remove child entries', async () => {
  const example = createExample()
  const {Page, Container} = example.schema
  const parent = Edit.create(Container)
  const sub = parent.createChild(Container)
  const entry = sub.createChild(Page)
  await example.commit(parent, sub, entry)
  const res1 = await example.get({
    select: Entry,
    filter: {_id: entry.entryId}
  })
  assert.ok(res1)
  assert.is(res1.parent, sub.entryId)
  await example.commit(Edit.remove(parent.entryId))
  const res2 = await example.find({first: true, filter: {_id: entry.entryId}})
  assert.not.ok(res2)
})

test('change draft path', async () => {
  const example = createExample()
  const {Container} = example.schema
  const parent = Edit.create(Container).set({path: 'parent'})
  const sub = parent.createChild(Container).set({path: 'sub'})
  await example.commit(parent, sub)
  const resParent0 = await example.get({
    select: Entry,
    filter: {_id: parent.entryId}
  })
  assert.is(resParent0.url, '/parent')
  // Changing entry paths in draft should not have an influence on
  // computed properties such as url, filePath etc. until we publish.
  await example.commit(
    Edit.update(parent.entryId, Container).set({path: 'new-path'}).draft()
  )
  const resParent1 = await example.get({
    select: Entry,
    filter: {_id: parent.entryId},
    status: 'draft'
  })
  assert.is(resParent1.url, '/parent')
  const res1 = await example.get({
    select: Entry,
    filter: {_id: sub.entryId}
  })
  assert.is(res1.url, '/parent/sub')

  // Once we publish, the computed properties should be updated.
  await example.commit(Edit.publish(parent.entryId))
  const resParent2 = await example.get({
    select: Entry,
    filter: {_id: parent.entryId}
  })
  assert.is(resParent2.url, '/new-path')
  const res2 = await example.get({
    select: Entry,
    filter: {_id: sub.entryId}
  })
  assert.is(res2.url, '/new-path/sub')
})

test('fetch translations', async () => {
  const example = createExample()
  const {Page} = example.schema
  let res = await example.get({
    locale: 'en',
    location: example.workspaces.main.multiLanguage,
    select: {
      translations: {
        translations: {},
        type: Page,
        select: Query.locale
      }
    },
    filter: {_path: 'localised1'}
  })
  assert.equal(res.translations, ['en', 'fr'])
  res = await example.get({
    locale: 'en',
    location: example.workspaces.main.multiLanguage,
    select: {
      translations: {
        translations: {},
        type: Page,
        select: Query.locale
      }
    },
    filter: {_path: 'localised1'}
  })
  assert.equal(res.translations, ['fr'])
})

test('change published path for entry with language', async () => {
  const example = createExample()
  const localised3 = await example.get({
    locale: 'en',
    location: example.workspaces.main.multiLanguage,
    select: Entry,
    filter: {_path: 'localised3'}
  })
  assert.is(localised3.url, '/en/localised2/localised3')

  // Archive localised3
  await example.commit(Edit.archive(localised3.entryId))

  const localised3Archived = await example.get({
    location: example.workspaces.main.multiLanguage,
    select: Entry,
    filter: {_path: 'localised3'},
    status: 'archived'
  })
  assert.is(localised3Archived.phase, EntryPhase.Archived)

  // And publish again
  await example.commit(Edit.publish(localised3.entryId))
  const localised3Publish = await example.get({
    locale: 'en',
    select: Entry,
    filter: {_path: 'localised3'}
  })
  assert.is(localised3Publish.url, '/en/localised2/localised3')
})

test('file upload', async () => {
  const example = createExample()
  const upload = Edit.upload([
    'test.txt',
    new TextEncoder().encode('Hello, World!')
  ])
  await example.commit(upload)
  const result = await example.get({
    select: Entry,
    filter: {_id: upload.entryId}
  })
  assert.is(result.title, 'test')
  assert.is(result.root, 'media')
})

test('image upload', async () => {
  const example = createExample()
  const imageData = readFileSync(
    'apps/web/public/screenshot-2022-09-19-at-12-21-23.2U9fkc81kcSh2InU931HrUJstwD.png'
  )
  const upload = Edit.upload(['test.png', new Uint8Array(imageData)], {
    createPreview
  })
  await example.commit(upload)
  const result = await example.get({
    select: Entry,
    filter: {_id: upload.entryId}
  })
  assert.is(result.title, 'test')
  assert.is(result.root, 'media')
  assert.is(result.data.width, 2880)
  assert.is(result.data.height, 1422)
  assert.is(result.data.averageColor, '#4b4f59')
})

test('field creators', async () => {
  const example = createExample()
  const {Fields} = example.schema
  const entry = Edit.create(Fields)
  const listEditor = Edit.list(Fields.list)
  const list = listEditor
    .add('Text', {
      title: '',
      text: Edit.richText(Fields.richText)
        .addHtml(
          `
            <h1>Test</h1>
            <p>This will be quite useful.</p>
          `
        )
        .value()
    })
    .value()
  entry.set({title: 'Fields', list})
  await example.commit(entry)
  const res = (await example.get({
    select: Fields.list,
    filter: {_id: entry.entryId}
  }))![0]
  if (res[Node.type] !== 'Text') throw new Error('Expected Text')
  assert.equal(res.text[0], {
    [Node.type]: 'heading',
    level: 1,
    [ElementNode.content]: [{[Node.type]: 'text', [TextNode.text]: 'Test'}]
  })
})

test('remove media library and files', async () => {
  const example = createExample()
  const {MediaLibrary, MediaFile} = example.schema
  const library = Edit.create(MediaLibrary)
    .setWorkspace('main')
    .setRoot('media')
  await example.commit(library)
  const upload = Edit.upload([
    'test.txt',
    new TextEncoder().encode('Hello, World!')
  ]).setParent(library.entryId)
  await example.commit(upload)
  const result = await example.get({
    select: Entry,
    filter: {_id: upload.entryId}
  })
  assert.is(result.parent, library.entryId)
  assert.is(result.root, 'media')
  await example.commit(Edit.remove(library.entryId))
  const result2 = await example.first({
    filter: {_id: upload.entryId}
  })
  assert.not.ok(result2)
})

test('create multi language entries', async () => {
  const example = createExample()
  const {Page} = example.schema
  const localised2 = await example.get({
    select: Entry,
    filter: {_path: 'localised2'}
  })
  const entry = Edit.create(Page).setParent(localised2.entryId).set({
    title: 'New entry',
    path: 'new-entry'
  })
  await example.commit(entry)
  const result = await example.get({
    select: Entry,
    filter: {_id: entry.entryId}
  })
  assert.is(result.url, '/en/localised2/new-entry')
})

test.run()
