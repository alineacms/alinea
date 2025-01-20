import {Entry} from 'alinea/core'
import {EntryStatus} from 'alinea/core/EntryRow'
import {ElementNode, Node, TextNode} from 'alinea/core/TextDoc'
import {createPreview} from 'alinea/core/media/CreatePreview'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import * as Edit from 'alinea/edit'
import {translations} from 'alinea/query'
import {readFileSync} from 'fs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createExample} from './test/Example.js'

test('create', async () => {
  const example = createExample()
  const {Page, Container} = example.schema
  const parent = Edit.create({
    type: Page,
    set: {title: 'New parent'}
  })
  await example.commit(parent)
  const result = await example.get({
    select: Entry,
    id: parent.id
  })
  assert.is(result.id, parent.id)
  assert.is(result.title, 'New parent')
  const multiType = await example.find({
    type: [Page, Container]
  })
  assert.is(multiType.length, 11)
})

test('index is correct', async () => {
  const example = createExample()
  const {Page} = example.schema
  const container1 = await example.get({
    path: 'container1'
  })
  const entryA = Edit.create({
    type: Page,
    parentId: container1._id
  })
  await example.commit(entryA)
  const entryB = Edit.create({
    type: Page,
    parentId: container1._id
  })
  await example.commit(entryB)
  const entries = await example.find({
    parentId: container1._id
  })
  const first = generateKeyBetween(null, null)
  const second = generateKeyBetween(first, null)
  assert.is(entries[0]._id, entryA.id)
  assert.is(entries[0]._index, first)
  assert.is(entries[1]._id, entryB.id)
  assert.is(entries[1]._index, second)
})

test('remove child entries', async () => {
  const example = createExample()
  const {Page, Container} = example.schema
  const parent = Edit.create({type: Container, set: {title: 'Parent'}})
  const sub = Edit.create({
    type: Container,
    parentId: parent.id,
    set: {title: 'Sub'}
  })
  const entry = Edit.create({
    type: Page,
    parentId: sub.id,
    set: {title: 'Deepest'}
  })
  await example.commit(parent)
  await example.commit(sub)
  await example.commit(entry)
  const res1 = await example.get({
    id: entry.id
  })
  assert.is(res1._parentId, sub.id)
  await example.commit(Edit.remove(parent.id))
  const res2 = await example.first({id: entry.id})
  assert.not.ok(res2)
})

test('change draft path', async () => {
  const example = createExample()
  const {Container} = example.schema
  const parent = Edit.create({
    type: Container,
    set: {path: 'parent'}
  })
  const sub = Edit.create({
    type: Container,
    parentId: parent.id,
    set: {path: 'sub'}
  })
  await example.commit(parent)
  await example.commit(sub)
  const resParent0 = await example.get({
    select: Entry,
    id: parent.id
  })
  assert.is(resParent0.url, '/parent')
  // Changing entry paths in draft should not have an influence on
  // computed properties such as url, filePath etc. until we publish.
  await example.commit(
    Edit.update({
      id: parent.id,
      type: Container,
      status: 'draft',
      set: {path: 'new-path'}
    })
  )
  const resParent1 = await example.get({
    select: Entry,
    id: parent.id,
    status: 'draft'
  })
  assert.is(resParent1.url, '/parent')
  const res1 = await example.get({
    select: Entry,
    id: sub.id
  })
  assert.is(res1.url, '/parent/sub')

  // Once we publish, the computed properties should be updated.
  await example.commit(
    Edit.update({
      id: parent.id,
      status: 'published'
    })
  )
  const resParent2 = await example.get({
    select: Entry,
    id: parent.id
  })
  assert.is(resParent2.url, '/new-path')
  const res2 = await example.get({
    select: Entry,
    id: sub.id
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
      translations: translations({
        includeSelf: true,
        type: Page,
        select: Entry.locale
      })
    },
    path: 'localised1'
  })
  assert.equal(res.translations, ['en', 'fr'])
  res = await example.get({
    locale: 'en',
    location: example.workspaces.main.multiLanguage,
    select: {
      translations: {
        edge: 'translations',
        type: Page,
        select: Entry.locale
      }
    },
    path: 'localised1'
  })
  assert.equal(res.translations, ['fr'])
})

test('change published path for entry with language', async () => {
  const example = createExample()
  const localised3 = await example.get({
    locale: 'en',
    location: example.workspaces.main.multiLanguage,
    select: Entry,
    path: 'localised3'
  })
  assert.is(localised3.url, '/en/localised2/localised3')

  // Archive localised3
  await example.commit(
    Edit.update({
      id: localised3.id,
      status: 'archived'
    })
  )

  const localised3Archived = await example.get({
    location: example.workspaces.main.multiLanguage,
    select: Entry,
    path: 'localised3',
    status: 'archived'
  })
  assert.is(localised3Archived.status, EntryStatus.Archived)

  // And publish again
  await example.commit(
    Edit.update({
      id: localised3.id,
      status: 'published'
    })
  )
  const localised3Publish = await example.get({
    locale: 'en',
    path: 'localised3',
    select: Entry
  })
  assert.is(localised3Publish.url, '/en/localised2/localised3')
})

test('file upload', async () => {
  const example = createExample()
  const upload = Edit.upload({
    file: new File(['Hello, World!'], 'test.txt')
  })
  await example.commit(upload)
  const result = await example.get({
    select: Entry,
    id: upload.id
  })
  assert.is(result.title, 'test')
  assert.is(result.root, 'media')
})

test('image upload', async () => {
  const example = createExample()
  const imageData = readFileSync(
    'apps/web/public/screenshot-2022-09-19-at-12-21-23.2U9fkc81kcSh2InU931HrUJstwD.png'
  )
  const upload = Edit.upload({
    file: new File([new Uint8Array(imageData)], 'test.png'),
    createPreview
  })
  await example.commit(upload)
  const result = await example.get({
    select: Entry,
    id: upload.id
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
  const entry = Edit.create({
    type: Fields,
    set: {
      title: 'Fields',
      list
    }
  })
  await example.commit(entry)
  const listRes = await example.get({
    select: Fields.list,
    id: entry.id
  })
  const res = listRes[0]
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
  const library = Edit.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {
      title: 'Test library'
    }
  })
  await example.commit(library)
  const upload = Edit.upload({
    file: new File(['Hello, World!'], 'test.txt'),
    parentId: library.id
  })
  await example.commit(upload)
  const result = await example.get({
    select: Entry,
    id: upload.id
  })
  assert.is(result.parentId, library.id)
  assert.is(result.root, 'media')
  await example.commit(Edit.remove(library.id))
  const result2 = await example.first({
    id: upload.id
  })
  assert.not.ok(result2)
})

test('create multi language entries', async () => {
  const example = createExample()
  const {Page} = example.schema
  const localised2 = await example.get({
    select: Entry,
    path: 'localised2'
  })
  const entry = Edit.create({
    type: Page,
    parentId: localised2.id,
    set: {
      title: 'New entry',
      path: 'new-entry'
    }
  })
  await example.commit(entry)
  const result = await example.get({
    select: Entry,
    id: entry.id
  })
  assert.is(result.url, '/en/localised2/new-entry')
})

test('filters', async () => {
  const example = createExample()
  const {Page} = example.schema
  const entry = Edit.create({
    type: Page,
    set: {
      title: 'New entry',
      entryLink: Edit.links(Page.entryLink).addEntry('xyz').value(),
      list: Edit.list(Page.list)
        .add('item', {
          itemId: 'item-1'
        })
        .value()
    }
  })
  await example.commit(entry)
  const result = await example.find({
    type: Page,
    filter: {
      list: {includes: {itemId: 'item-1'}}
    }
  })
  assert.is(result.length, 1)
  const result2 = await example.find({
    type: Page,
    filter: {
      entryLink: {
        includes: {
          _entry: 'xyz'
        }
      }
    }
  })
  assert.is(result2.length, 1)
})

test('remove field contents', async () => {
  const example = createExample()
  const {Page} = example.schema
  const entry = await example.create({
    type: Page,
    set: {title: 'xyz', name: 'test'}
  })
  const updated = await example.update({
    type: Page,
    id: entry._id,
    set: {name: undefined}
  })
  assert.is(updated.title, 'xyz')
  assert.is(updated.name, null)
})

test('take/skip', async () => {
  const example = createExample()
  const {Page} = example.schema
  const lastTwo = await example.find({
    root: example.workspaces.main.pages,
    skip: 1,
    take: 2
  })
  assert.is(lastTwo.length, 2)
  const lastOne = await example.find({
    root: example.workspaces.main.pages,
    skip: 2,
    take: 1
  })
  assert.is(lastOne.length, 1)
})

test.run()
