import {expect, spyOn, test} from 'bun:test'
import {mkdtemp, readdir, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {Field as FieldUtils} from '#/core/Field.js'
import {createRecord} from '#/core/EntryRecord.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {children} from '#/query.js'
import {NodeReplica} from './NodeReplica.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import type {GraphQuery, AnyQueryResult} from '#/core/Graph.js'

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
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

test('SQL snapshot previews accept entry and revision-bound patch inputs without publishing either view', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-preview-'))
  const fixture = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Original'},
    {id: 'child', type: 'Page', index: 'b', title: 'Child', parentPaths: ['a']}
  ])
  const replica = await NodeReplica.open(
    {directory, config, identity},
    fixture.source
  )
  try {
    const entry = await replica.get({id: 'a', select: Entry})
    const revision = replica.revision
    const files = await readdir(directory)
    const base = JSON.stringify(createRecord(entry, entry.status), null, 2)
    const edited = {...entry, data: {...entry.data, title: 'Patched'}}
    const patch = await createFilePatch(
      base,
      JSON.stringify(createRecord(edited, entry.status), null, 2)
    )
    const update = {
      entryId: entry.id,
      locale: entry.locale,
      status: entry.status,
      contentHash: revision,
      patch
    }
    const payload = await encodePreviewPayload(update)
    const first = {
      entry: {
        ...entry,
        fileHash: 'same-marker',
        data: {...entry.data, title: 'Left'}
      }
    }
    const second = {
      entry: {
        ...entry,
        fileHash: 'same-marker',
        data: {...entry.data, title: 'Right'}
      }
    }
    expect(
      await Promise.all([
        replica.first({id: 'a', select: Entry.title, preview: first}),
        replica.first({id: 'a', select: Entry.title, preview: second}),
        replica.first({id: 'a', select: Entry.title, preview: {payload}}),
        replica.first({id: 'a', select: Entry.title})
      ])
    ).toEqual(['Left', 'Right', 'Patched', 'Original'])
    expect(
      await replica.first({
        id: 'a',
        preview: {payload},
        select: {
          title: Entry.title,
          children: children({select: Entry.title})
        }
      })
    ).toEqual({title: 'Patched', children: ['Child']})
    expect(replica.revision).toBe(revision)
    expect(await readdir(directory)).toEqual(files)
    const stale = await encodePreviewPayload({...update, contentHash: 'stale'})
    await expect(replica.find({preview: {payload: stale}})).rejects.toThrow(
      'SHA mismatch'
    )
    const invalid = await encodePreviewPayload({
      ...update,
      patch: new Uint8Array(40)
    })
    await expect(replica.find({preview: {payload: invalid}})).rejects.toThrow(
      'could not be applied'
    )
    expect(
      await replica.find({preview: first, search: 'Left', select: Entry.id})
    ).toEqual(['a'])
    expect(await replica.first({id: 'a', select: Entry.title})).toBe('Original')
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const queryValue = FieldUtils.queryValue
    const processing = spyOn(FieldUtils, 'queryValue').mockImplementation(
      async (field, value, context) => {
        if (value === 'Left') {
          started.resolve()
          await release.promise
        }
        return queryValue(field, value, context)
      }
    )
    try {
      const pending = replica.first({
        id: 'a',
        preview: first,
        select: {
          title: Page.title,
          children: children({select: Entry.title})
        }
      })
      await started.promise
      const changed = await createEntryResolver(config, [
        {id: 'a', type: 'Page', index: 'a', title: 'New base'},
        {
          id: 'child',
          type: 'Page',
          index: 'b',
          title: 'New child',
          parentPaths: ['a']
        }
      ])
      await replica.sync(changed.source)
      expect(await replica.first({id: 'child', select: Entry.title})).toBe(
        'New child'
      )
      await replica.close()
      release.resolve()
      expect(await pending).toEqual({title: 'Left', children: ['Child']})
    } finally {
      release.resolve()
      processing.mockRestore()
    }
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('live patch verification and nested queries retain one snapshot across sync and close', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-live-preview-'))
  const initial = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Original'},
    {id: 'child', type: 'Page', index: 'b', parentPaths: ['a'], title: 'Child'}
  ])
  const changed = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Later'},
    {
      id: 'child',
      type: 'Page',
      index: 'b',
      parentPaths: ['a'],
      title: 'Later child'
    }
  ])
  const replica = await NodeReplica.open(
    {config, directory, identity},
    initial.source
  )
  try {
    const entry = await replica.get({id: 'a', select: Entry})
    const edited = {...entry, data: {...entry.data, title: 'Preview'}}
    const patch = await createFilePatch(
      JSON.stringify(createRecord(entry, entry.status), null, 2),
      JSON.stringify(createRecord(edited, entry.status), null, 2)
    )
    const payload = await encodePreviewPayload({
      entryId: 'a',
      locale: null,
      status: 'published',
      contentHash: replica.revision,
      patch
    })
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const resolve = EntryRuntime.prototype.resolve
    let held = false
    const reading = spyOn(EntryRuntime.prototype, 'resolve').mockImplementation(
      async function <Query extends GraphQuery>(
        this: EntryRuntime,
        query: Query
      ): Promise<AnyQueryResult<Query>> {
        const value = await resolve.bind(this)<Query>(query)
        if (!held && query.select === Entry && query.id === 'a') {
          held = true
          started.resolve()
          await release.promise
        }
        return value
      }
    )
    try {
      const pending = replica.resolvePreview(
        {
          id: 'a',
          get: true,
          preview: {payload},
          select: {
            title: Entry.title,
            children: children({select: Entry.title})
          }
        },
        changed.source
      )
      await started.promise
      await replica.sync(changed.source)
      await replica.close()
      release.resolve()
      expect(await pending).toEqual({title: 'Preview', children: ['Child']})
    } finally {
      release.resolve()
      reading.mockRestore()
    }
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})
