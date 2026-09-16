import {expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const Doc = ConfigBuilder.document('Doc', {
  fields: {title: Field.text('Title'), path: Field.path('Path')}
})
const cms = createCMS({
  schema: {Doc},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {pages: ConfigBuilder.root('Pages', {contains: ['Doc']})}
    })
  }
})

interface DocInput {
  id: string
  title: string
  status?: 'draft' | 'published'
}

async function remoteWith(docs: Array<DocInput>) {
  return createEntrySource(
    cms.config,
    docs.map((doc, index) => ({
      id: doc.id,
      type: 'Doc',
      index: `a${String(index).padStart(4, '0')}`,
      path: doc.id,
      status: doc.status ?? 'published',
      data: {title: doc.title, path: doc.id}
    }))
  )
}

/** Replicates the Next.js handler: readonly generated database plus a
 * long-lived overlay synced repeatedly against a remote source. */
test('handler syncs a readonly database through an overlay', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'handler-sync-'))
  const path = join(dir, 'generated.sqlite')
  try {
    // Build step: populate the generated database file.
    {
      const sqlite = new Database(path)
      const db = connect(sqlite)
      await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
      const store = new EntryStore(
        cms.config,
        new EntryDatabase(cms.config, db),
        new MemorySource(),
        {ownsDatabase: true}
      )
      await store.syncWith(
        await remoteWith([
          {id: 'a', title: 'Alpha'},
          {id: 'b', title: 'Beta'},
          {id: 'c', title: 'Gamma'}
        ])
      )
      await store.close()
      sqlite.close()
    }
    // Handler cold open: fresh instances, readonly base, overlay on top.
    const sqlite = new Database(path, {readonly: true})
    const db = connect(sqlite)
    const base = new EntryDatabase(cms.config, db)
    const overlay = await base.createOverlay()
    const store = new EntryStore(cms.config, overlay.database, overlay.source, {
      close: async () => {
        await overlay.close()
        await base.close()
      }
    })
    try {
      // First sync reconciles the overlay against the remote.
      await store.syncWith(
        await remoteWith([
          {id: 'a', title: 'Alpha'},
          {id: 'b', title: 'Beta 2'},
          {id: 'd', title: 'Delta'}
        ])
      )
      expect(await store.find({type: Doc, select: Entry.id})).toEqual([
        'a',
        'b',
        'd'
      ])
      expect(
        await store.get({id: 'b', select: {title: Doc.title}})
      ).toEqual({title: 'Beta 2'})
      // A second sync in the same handler picks up incremental changes.
      await store.syncWith(
        await remoteWith([
          {id: 'a', title: 'Alpha'},
          {id: 'b', title: 'Beta 2'},
          {id: 'd', title: 'Delta 2'}
        ])
      )
      expect(
        await store.get({id: 'd', select: {title: Doc.title}})
      ).toEqual({title: 'Delta 2'})
      expect(await store.find({type: Doc, select: Entry.id})).toEqual([
        'a',
        'b',
        'd'
      ])
    } finally {
      await store.close()
      sqlite.close()
    }
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
