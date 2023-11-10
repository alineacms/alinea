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
  const typeNames = Schema.typeNames(cms.schema)
  const title = data.title ?? 'Entry'
  const details = {
    entryId: createId(),
    phase: EntryPhase.Published,
    type: typeNames.get(type)!,
    title,
    path: data.path ?? slugify(title),
    seeded: false,
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
  const filePath = entryFilepath(cms, details, parentPaths)
  const childrenDir = entryChildrenDir(cms, details, parentPaths)
  const row = {
    ...details,
    filePath,
    childrenDir,
    parentDir: childrenDir.split('/').slice(0, -1).join('/'),
    url: childrenDir
  }
  return createEntryRow(cms, row)
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
  const db = await example.db
  const entry1 = await entry(example, example.schema.Page, {
    title: 'Test title'
  })
  await db.applyMutations([create(entry1)])
  const result = await example.get(Entry({entryId: entry1.entryId}))
  assert.is(result.entryId, entry1.entryId)
  assert.is(result.title, 'Test title')
})

test('remove child entries', async () => {
  const example = createExample()
  const db = await example.db
  const parent = await entry(example, example.schema.Container)
  const sub = await entry(example, example.schema.Container, {}, parent)
  const subSub = await entry(example, example.schema.Page, {}, sub)

  await db.applyMutations([create(parent), create(sub), create(subSub)])

  const res1 = await example.get(Entry({entryId: subSub.entryId}))
  assert.ok(res1)
  assert.is(res1.parent, sub.entryId)

  await db.applyMutations([remove(parent)])

  const res2 = await example.get(Entry({entryId: subSub.entryId}))
  assert.not.ok(res2)
})

test.only('change draft path', async () => {
  const example = createExample()
  const db = await example.db
  const parent = await entry(example, example.schema.Container, {
    path: 'parent'
  })
  const sub = await entry(
    example,
    example.schema.Container,
    {path: 'sub'},
    parent
  )
  await db.applyMutations([create(parent), create(sub)])
  const draft = {...parent, phase: EntryPhase.Draft, path: 'new-path'}
  await db.applyMutations([edit(draft)])
  const resParent = await example.get(Entry({entryId: sub.entryId}))
  const res1 = await example.get(Entry({entryId: sub.entryId}))
  assert.is(res1.url, '/parent/sub')
  await db.applyMutations([publish(draft)])
  const res2 = await example.get(Entry({entryId: sub.entryId}))
  assert.is(res2.url, '/new-path/sub')
})

test.run()
