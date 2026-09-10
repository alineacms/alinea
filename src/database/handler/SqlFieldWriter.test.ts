import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {role} from '#/core/Role.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {entryVersionId} from '../entry/Schema.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {hashFieldValue, type FieldTransaction} from '../replica/Operations.js'
import {
  SqlFieldWriter,
  FieldReceiptTable,
  type FieldCommitResult
} from './SqlFieldWriter.js'

test('routing changes roll back source, derived rows and receipts, and field denials fail closed', async () => {
  const Page = Config.document('Page', {
    fields: {
      title: Field.text('Title'),
      description: Field.text('Description')
    },
    entryUrl({data}) {
      return `/${data.title}`
    }
  })
  const config = {
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    },
    roles: {
      editor: role('Editor', {
        permissions(policy) {
          policy.allowAll()
          policy.set({field: Page.description, deny: {update: true}})
        }
      })
    }
  }
  const identity = {
    project: 'project',
    namespace: 'main',
    epoch: '1',
    schemaId: 'schema',
    configId: 'config',
    releaseId: 'release'
  }
  const fixture = await createEntryResolver(config, [
    {
      id: 'a',
      type: 'Page',
      index: 'a',
      title: 'First',
      data: {description: 'Protected'}
    }
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  await SqlFieldWriter.createSchema(db)
  const writer = new SqlFieldWriter(config, db, identity)
  const baseRevision = (await fixture.source.getTree()).sha
  const recordId = entryVersionId('a', null, 'published')
  await expect(
    writer.commit('alice', ['editor'], {
      id: 'routing',
      baseRevision,
      operations: [
        {
          kind: 'set',
          recordId,
          path: '/title',
          baseHash: await hashFieldValue('First'),
          value: 'New route'
        }
      ]
    })
  ).rejects.toThrow('structural mutation handling')
  await expect(
    writer.commit('alice', ['editor'], {
      id: 'denied',
      baseRevision,
      operations: [
        {
          kind: 'set',
          recordId,
          path: '/description',
          baseHash: null,
          value: 'Must not leak conflict values'
        }
      ]
    })
  ).rejects.toThrow('not authorized')
  const {runtime, descriptor} = await openCheckpoint(config, db, identity)
  expect(descriptor.sourceSha).toBe(baseRevision)
  expect(await runtime.find({select: Entry.url})).toEqual(['/First'])
  expect(await db.select().from(FieldReceiptTable)).toEqual([])
})

test('SQL authority commits independent fields and durable principal-scoped receipts atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-field-writer-'))
  const file = join(directory, 'authority.sqlite')
  const Page = Config.document('Page', {
    fields: {title: Field.text('Title'), description: Field.text('Description')}
  })
  let revoked = false
  const config = {
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    },
    roles: {
      editor: role('Editor', {
        permissions(policy) {
          if (!revoked) policy.allowAll()
        }
      })
    }
  }
  const identity = {
    project: 'project',
    namespace: 'main',
    epoch: '1',
    schemaId: 'schema',
    configId: 'config',
    releaseId: 'release'
  }
  try {
    const fixture = await createEntryResolver(config, [
      {
        id: 'a',
        type: 'Page',
        index: 'a',
        title: 'First',
        data: {description: 'Original'}
      }
    ])
    const baseRevision = (await fixture.source.getTree()).sha
    const recordId = entryVersionId('a', null, 'published')
    const first: FieldTransaction = {
      id: 'first',
      baseRevision,
      operations: [
        {
          kind: 'set',
          recordId,
          path: '/title',
          baseHash: await hashFieldValue('First'),
          value: 'Updated'
        }
      ]
    }
    let accepted!: FieldCommitResult
    {
      using sqlite = new Database(file)
      const db = connect(sqlite)
      await buildDatabase(config, db, fixture.source, identity)
      await SqlFieldWriter.createSchema(db)
      const writer = new SqlFieldWriter(config, db, identity)
      accepted = await writer.commit('alice', ['editor'], first)
      await writer.commit('alice', ['editor'], {
        id: 'second',
        baseRevision,
        operations: [
          {
            kind: 'set',
            recordId,
            path: '/description',
            baseHash: await hashFieldValue('Original'),
            value: 'Merged'
          }
        ]
      })
      const {runtime} = await openCheckpoint(config, db, identity)
      expect(await runtime.find({select: Entry.data})).toEqual([
        {title: 'Updated', description: 'Merged', path: 'a'}
      ])
      const revision = await runtime.getRevision()
      await expect(
        writer.commit('alice', ['editor'], {
          id: 'conflicting-batch',
          baseRevision,
          operations: [
            {
              kind: 'set',
              recordId,
              path: '/description',
              baseHash: await hashFieldValue('Merged'),
              value: 'Must roll back'
            },
            {...first.operations[0], kind: 'set', value: 'Conflict'}
          ]
        })
      ).rejects.toThrow('changed remotely')
      expect(
        await (
          await openCheckpoint(config, db, identity)
        ).runtime.find({select: Entry.data})
      ).toEqual([{title: 'Updated', description: 'Merged', path: 'a'}])
      await expect(writer.commit('bob', ['editor'], first)).rejects.toThrow(
        'changed remotely'
      )
      expect(
        (await openCheckpoint(config, db, identity)).descriptor.sourceSha
      ).toBe(revision)
      expect(await db.select().from(FieldReceiptTable)).toHaveLength(2)
    }
    {
      using sqlite = new Database(file)
      const db = connect(sqlite)
      const writer = new SqlFieldWriter(config, db, identity)
      expect(await writer.commit('alice', ['editor'], first)).toEqual(accepted)
      await expect(
        writer.commit('alice', ['editor'], {
          ...first,
          operations: [
            {...first.operations[0], kind: 'set', value: 'Different'}
          ]
        })
      ).rejects.toThrow('reused with a different request')
      revoked = true
      await expect(writer.commit('alice', ['editor'], first)).rejects.toThrow(
        'not authorized'
      )
      expect(await db.select().from(FieldReceiptTable)).toHaveLength(2)
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
