import {expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import {Config as ConfigUtils} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'

const Doc = ConfigBuilder.document('Doc', {
  fields: {title: Field.text('Title'), path: Field.path('Path')}
})
const Other = ConfigBuilder.document('Other', {
  fields: {title: Field.text('Title'), path: Field.path('Path')}
})
const cms = createCMS({
  schema: {Doc, Other},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {pages: ConfigBuilder.root('Pages', {contains: ['Doc', 'Other']})}
    })
  }
})

interface DocInput {
  id: string
  type: string
  status?: 'draft' | 'published'
}

async function remoteWith(docs: Array<DocInput>) {
  const source = new MemorySource()
  const changes = await Promise.all(
    docs.map(async doc => {
      const status = doc.status ?? 'published'
      const suffix = status === 'published' ? '' : `.${status}`
      const record = createRecord(
        {
          id: doc.id,
          type: doc.type,
          index: 'a0',
          parentId: null,
          root: 'pages',
          path: doc.id,
          title: doc.id,
          seeded: null,
          data: {title: doc.id, path: doc.id}
        },
        status
      )
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      return {
        op: 'add' as const,
        path: ConfigUtils.filePath(cms.config, 'main', 'pages', null, `${doc.id}${suffix}.json`),
        sha: await hashBlob(contents),
        contents
      }
    })
  )
  const tree = await source.getTree()
  await source.applyChanges({fromSha: tree.sha, changes})
  return source
}

/** A failed validation rolls the whole sync back: revision and rows are
 * untouched and a later valid sync succeeds. */
test('failed validation rolls back the sync', async () => {
  const sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const store = new EntryStore(cms.config, new EntryDatabase(cms.config, db), new MemorySource(), {
    ownsDatabase: true
  })
  try {
    const sha = await store.syncWith(
      await remoteWith([
        {id: 'a', type: 'Doc'},
        {id: 'b', type: 'Doc'}
      ])
    )
    await expect(
      store.syncWith(
        await remoteWith([
          {id: 'a', type: 'Doc'},
          {id: 'b', type: 'Doc'},
          {id: 'a', type: 'Other', status: 'draft'}
        ])
      )
    ).rejects.toThrow('Mismatched authored entry versions')
    expect(await store.sha).toBe(sha)
    expect(await store.find({select: Entry.id})).toEqual(['a', 'b'])
    await store.syncWith(
      await remoteWith([
        {id: 'a', type: 'Doc'},
        {id: 'b', type: 'Doc'},
        {id: 'c', type: 'Doc'}
      ])
    )
    expect(await store.find({select: Entry.id})).toEqual(['a', 'b', 'c'])
  } finally {
    await store.close()
    sqlite.close()
  }
})

/** A remote whose entries were validated by its own database can be synced
 * with validation switched off. */
test('syncWith can skip validation for an already validated remote', async () => {
  const invalid = await remoteWith([
    {id: 'a', type: 'Doc'},
    {id: 'a', type: 'Other', status: 'draft'}
  ])
  const validating = await EntryStore.memory(cms.config, new MemorySource())
  try {
    await expect(validating.syncWith(invalid)).rejects.toThrow(
      'Mismatched authored entry versions'
    )
  } finally {
    await validating.close()
  }
  const trusting = await EntryStore.memory(cms.config, new MemorySource())
  try {
    await trusting.syncWith(invalid, {validate: false})
    expect(await trusting.find({select: Entry.id, status: 'all'})).toEqual([
      'a',
      'a'
    ])
  } finally {
    await trusting.close()
  }
})
