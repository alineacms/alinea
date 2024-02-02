import {
  CMS,
  Entry,
  EntryPhase,
  EntryRow,
  Schema,
  Type,
  createId,
  slugify
} from 'alinea/core'
import {entryChildrenDir, entryFilepath} from 'alinea/core/EntryFilenames'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createExample} from './test/Example.js'

async function entry(
  cms: CMS,
  type: Type,
  data: Partial<EntryRow> = {title: 'Entry'},
  parent?: EntryRow
): Promise<EntryRow> {
  const typeNames = Schema.typeNames(cms.config.schema)
  const title = data.title ?? 'Entry'
  const details = {
    entryId: createId(),
    phase: EntryPhase.Published,
    type: typeNames.get(type)!,
    title,
    path: data.path ?? slugify(title),
    seeded: null,
    workspace: 'main',
    root: 'pages',
    level: 0,
    parent: parent?.entryId ?? null,
    locale: null,
    index: 'a0',
    i18nId: createId(),
    modifiedAt: 0,
    active: true,
    main: true,
    data: data.data ?? {},
    searchableText: ''
  }
  const parentPaths = parent?.childrenDir.split('/').filter(Boolean) ?? []
  const filePath = entryFilepath(cms.config, details, parentPaths)
  const childrenDir = entryChildrenDir(cms.config, details, parentPaths)
  const row = {
    ...details,
    filePath,
    childrenDir,
    parentDir: childrenDir.split('/').slice(0, -1).join('/'),
    url: childrenDir
  }
  return createEntryRow(cms.config, row)
}

function create(entry: EntryRow): Mutation {
  return {
    type: MutationType.Create,
    entry: entry,
    entryId: entry.entryId,
    file: entry.filePath
  }
}

function remove(entry: EntryRow): Mutation {
  return {
    type: MutationType.Remove,
    entryId: entry.entryId,
    file: entry.filePath
  }
}

function edit(entry: EntryRow): Mutation {
  return {
    type: MutationType.Edit,
    entryId: entry.entryId,
    file: entry.filePath,
    entry: entry
  }
}

function archive(entry: EntryRow): Mutation {
  return {
    type: MutationType.Archive,
    entryId: entry.entryId,
    file: entry.filePath
  }
}

function publish(entry: EntryRow): Mutation {
  return {
    type: MutationType.Publish,
    entryId: entry.entryId,
    file: entry.filePath,
    phase: entry.phase
  }
}

test('create', async () => {
  const example = createExample()
  const {Page} = example.schema
  const parentId = await example
    .create(Page)
    .set({title: 'Test title'})
    .publish()
  const result = await example.get(Entry({entryId: parentId}))
  assert.is(result.entryId, parentId)
  assert.is(result.title, 'Test title')
})

test('remove child entries', async () => {
  const example = createExample()
  const {Page, Container} = example.schema
  const parentId = await example.create(Container).publish()
  const subId = await example.edit(parentId).createChild(Container).publish()
  const entryId = await example.edit(subId).createChild(Page).publish()
  const res1 = await example.get(Entry({entryId}))
  assert.ok(res1)
  assert.is(res1.parent, subId)
  await example.delete(parentId).commit()
  const res2 = await example.get(Entry({entryId}))
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
  await example.edit(parent.entryId).set({path: 'new-path'}).saveDraft()
  const draft = {
    ...parent,
    phase: EntryPhase.Draft,
    data: {path: 'new-path'}
  }

  // Changing entry paths in draft should not have an influence on
  // computed properties such as url, filePath etc. until we publish.
  await db.applyMutations([edit(draft)])
  const resParent1 = await example.graph.drafts.get(
    Entry({entryId: parent.entryId})
  )
  assert.is(resParent1.url, '/parent')
  const res1 = await example.get(Entry({entryId: sub.entryId}))
  assert.is(res1.url, '/parent/sub')

  // Once we publish, the computed properties should be updated.
  await db.applyMutations([publish(draft)])
  const resParent2 = await example.get(Entry({entryId: parent.entryId}))
  assert.is(resParent2.url, '/new-path')
  const res2 = await example.get(Entry({entryId: sub.entryId}))
  assert.is(res2.url, '/new-path/sub')
})

test('change published path for entry with language', async () => {
  const example = createExample()
  const db = await example.db
  const multi = example.in(example.workspaces.main.multiLanguage)
  console.log(await multi.find(Entry()))
  const localised3 = await multi.get(Entry({path: 'localised3'}))
  assert.is(localised3.url, '/en/localised2/localised3')

  // Archive localised3
  await db.applyMutations([archive(localised3)])

  const localised3Archived = await example.graph.archived
    .in(example.workspaces.main.multiLanguage)
    .get(Entry({path: 'localised3'}))
  assert.is(localised3Archived.phase, EntryPhase.Archived)

  // And publish again
  await db.applyMutations([publish(localised3Archived)])
  const localised3Publish = await multi.get(Entry({path: 'localised3'}))
  assert.is(localised3Publish.url, '/en/localised2/localised3')
})

test.run()
