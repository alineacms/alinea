import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Config, Field} from '#/index.js'
import {Field as FieldUtils} from '#/core/Field.js'
import {Entry} from '#/core/Entry.js'
import {EntryGraph} from '#/core/db/EntryIndex.js'
import {children} from '#/query.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {NodeCheckpoint} from './NodeCheckpoint.js'

test('deployment checkpoints query in place and lease pending nested reads across close', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-pinned-'))
  const file = join(directory, 'release.sqlite')
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const config = {
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages')}
      })
    }
  }
  const identity = {
    project: 'project',
    namespace: 'main',
    epoch: '1',
    configId: 'config',
    schemaId: 'schema',
    releaseId: 'release'
  }
  const fixture = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Parent'},
    {id: 'child', type: 'Page', index: 'b', parentPaths: ['a'], title: 'Child'}
  ])
  try {
    {
      using sqlite = new Database(file)
      await buildDatabase(config, connect(sqlite), fixture.source, identity)
    }
    const before = await readFile(file)
    const normalize = spyOn(EntryGraph, 'fromParsed').mockImplementation(() => {
      throw new Error('Unexpected normalization')
    })
    try {
      await expect(
        NodeCheckpoint.open(config, file, {...identity, configId: 'wrong'})
      ).rejects.toThrow('configId mismatch')
      const db = await NodeCheckpoint.open(config, file, identity)
      const started = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const queryValue = FieldUtils.queryValue
      const processing = spyOn(FieldUtils, 'queryValue').mockImplementation(
        async (field, value, context) => {
          if (value === 'Parent') {
            started.resolve()
            await release.promise
          }
          return queryValue(field, value, context)
        }
      )
      try {
        expect(await db.find({search: 'child', select: Entry.id})).toEqual([
          'child'
        ])
        const pending = db.first({
          id: 'a',
          select: {title: Page.title, children: children({select: Entry.title})}
        })
        await started.promise
        db.close()
        release.resolve()
        expect(await pending).toEqual({title: 'Parent', children: ['Child']})
        await expect(db.find({})).rejects.toThrow('closed')
      } finally {
        release.resolve()
        processing.mockRestore()
        db.close()
      }
      expect(await readFile(file)).toEqual(before)
      expect(await readdir(directory)).toEqual(['release.sqlite'])
    } finally {
      normalize.mockRestore()
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
