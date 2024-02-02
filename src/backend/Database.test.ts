import {Entry, EntryPhase} from 'alinea/core'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createExample} from './test/Example.js'

test('create', async () => {
  const example = createExample()
  const {Page} = example.schema
  const parent = example.create(Page).set({title: 'Test title'})
  await parent.commit()
  const result = await example.get(Entry({entryId: parent.entryId}))
  assert.is(result.entryId, parent.entryId)
  assert.is(result.title, 'Test title')
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
  await example.createDraft(parent.entryId).set({path: 'new-path'}).commit()
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
  const multi = example.in(example.workspaces.main.multiLanguage)
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

test.run()
