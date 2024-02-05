import {File} from '@alinea/iso'
import {Entry, EntryPhase} from 'alinea/core'
import {readFileSync} from 'fs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createExample} from './test/Example.js'

test('create', async () => {
  const example = createExample()
  const {Page} = example.schema
  const parent = example.create(Page).set({title: 'New parent'})
  await parent.commit()
  const result = await example.get(Entry({entryId: parent.entryId}))
  assert.is(result.entryId, parent.entryId)
  assert.is(result.title, 'New parent')
})

test('remove child entries', async () => {
  const example = createExample()
  const {Page, Container} = example.schema
  const tx = example.transaction()
  const parent = tx.create(Container)
  const sub = parent.createChild(Container)
  const entry = sub.createChild(Page)
  await tx.commit()
  const res1 = await example.get(Entry({entryId: entry.entryId}))
  assert.ok(res1)
  assert.is(res1.parent, sub.entryId)
  await example.delete(parent.entryId).commit()
  const res2 = await example.get(Entry({entryId: entry.entryId}))
  assert.not.ok(res2)
})

test('change draft path', async () => {
  const example = createExample()
  const {Container} = example.schema
  const tx = example.transaction()
  const parent = tx.create(Container).set({path: 'parent'})
  const sub = parent.createChild(Container).set({path: 'sub'})
  await tx.commit()
  const resParent0 = await example.get(Entry({entryId: parent.entryId}))
  assert.is(resParent0.url, '/parent')
  // Changing entry paths in draft should not have an influence on
  // computed properties such as url, filePath etc. until we publish.
  await example
    .edit(parent.entryId, Container)
    .draft()
    .set({path: 'new-path'})
    .commit()
  const resParent1 = await example.graph.drafts.get(
    Entry({entryId: parent.entryId})
  )
  assert.is(resParent1.url, '/parent')
  const res1 = await example.get(Entry({entryId: sub.entryId}))
  assert.is(res1.url, '/parent/sub')

  // Once we publish, the computed properties should be updated.
  await example.edit(parent.entryId).publish().commit()
  const resParent2 = await example.get(Entry({entryId: parent.entryId}))
  assert.is(resParent2.url, '/new-path')
  const res2 = await example.get(Entry({entryId: sub.entryId}))
  assert.is(res2.url, '/new-path/sub')
})

test('change published path for entry with language', async () => {
  const example = createExample()
  const multi = example.locale('en').in(example.workspaces.main.multiLanguage)
  const localised3 = await multi.get(Entry({path: 'localised3'}))
  assert.is(localised3.url, '/en/localised2/localised3')

  // Archive localised3
  await example.edit(localised3.entryId).archive().commit()

  const localised3Archived = await example.graph.archived
    .in(example.workspaces.main.multiLanguage)
    .get(Entry({path: 'localised3'}))
  assert.is(localised3Archived.phase, EntryPhase.Archived)

  // And publish again
  await example.edit(localised3.entryId).publish().commit()
  const localised3Publish = await multi.get(Entry({path: 'localised3'}))
  assert.is(localised3Publish.url, '/en/localised2/localised3')
})

test('file upload', async () => {
  const example = createExample()
  const file = new File(['Hello, World!'], 'test.txt')
  const upload = example.upload(file)
  await upload.commit()
  const result = await example.get(Entry({entryId: upload.entryId}))
  assert.is(result.title, 'test')
  assert.is(result.root, 'media')
})

test('image upload', async () => {
  const example = createExample()
  const imageData = readFileSync(
    'apps/web/public/screenshot-2022-09-19-at-12-21-23.2U9fkc81kcSh2InU931HrUJstwD.png'
  )
  const file = new File([imageData], 'test.png')
  const upload = example.upload(file)
  await upload.commit()
  const result = await example.get(Entry({entryId: upload.entryId}))
  assert.is(result.title, 'test')
  assert.is(result.root, 'media')
  assert.is(result.data.width, 2880)
  assert.is(result.data.height, 1422)
  assert.is(result.data.averageColor, '#4b4f59')
})

test.run()
