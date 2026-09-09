import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {mkdtemp, readdir, readFile, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename, join} from 'node:path'
import {role} from '#/core/Role.js'
import {config, entry} from '#test/sqlite-browser/config.js'
import {EntryRuntime} from '#/database/runtime/EntryRuntime.js'
import {entryVersionId} from '#/database/entry/Schema.js'
import {GrantService} from '#/database/handler/Grants.js'
import {authorizedIndex} from '#/database/handler/Policy.js'
import {sha256Hash} from '#/core/source/Utils.js'
import {
  FrameStore,
  FrameTable,
  FrameLocationTable,
  buildFrames
} from '#/database/release/FrameStore.js'
import {decryptFrame, type FrameIdentity} from '#/database/replica/Frame.js'
import {exportFrameBundles} from './ExportFrameBundles.js'

const identity: FrameIdentity = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release',
  versionId: 'a',
  payloadId: 'payload',
  kind: 'data'
}

test('published grants resolve only authorized frames to their generated public byte ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-published-grant-'))
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const reader = role('Reader', {
    permissions(policy) {
      policy.allowAll().set({id: 'b', deny: {read: true}})
    }
  })
  const runtime = new EntryRuntime({...config, roles: {reader}}, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'b'].map(id => ({
      entry: entry(id),
      payloadId: id,
      data: {title: id}
    }))
  })
  await buildFrames(db, identity)
  const service = new GrantService(runtime, new FrameStore(db), identity)
  const view = await authorizedIndex(runtime, ['reader'])
  const request = {
    versionId: entryVersionId('a', null, 'published'),
    payloadId: 'a'
  }
  try {
    await expect(
      service.published(
        ['reader'],
        view,
        [request],
        'https://cdn.example.test/bundles/'
      )
    ).rejects.toThrow('not been published')
    await exportFrameBundles(db, directory)
    const [grant] = await service.published(
      ['reader'],
      view,
      [request],
      'https://cdn.example.test/bundles/'
    )
    const body = await readFile(
      join(directory, basename(new URL(grant.url).pathname))
    )
    const bytes = new Uint8Array(
      body.subarray(
        grant.offset,
        grant.offset + grant.descriptor.ciphertextLength
      )
    )
    expect(
      JSON.parse(
        new TextDecoder().decode(
          await decryptFrame(
            grant.descriptor,
            grant.descriptor,
            bytes,
            grant.key
          )
        )
      )
    ).toEqual({data: {title: 'a'}})
    await expect(
      service.published(
        ['reader'],
        view,
        [{versionId: entryVersionId('b', null, 'published'), payloadId: 'b'}],
        'https://cdn.example.test/bundles/'
      )
    ).rejects.toThrow('denied')
    await expect(
      service.published(
        ['reader'],
        view,
        [request],
        'https://cdn.example.test/bundles'
      )
    ).rejects.toThrow('base URL')
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('exports only ciphertext and privately records ranges in immutable reusable bundles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-public-bundles-'))
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await FrameStore.createSchema(db)
  const store = new FrameStore(db)
  try {
    for (const versionId of ['a', 'b', 'c'])
      await store.put(
        {...identity, versionId},
        new TextEncoder().encode(`PRIVATE ${versionId}`)
      )
    const exported = await exportFrameBundles(db, directory, {targetBytes: 1})
    expect(exported.bundles).toBe(3)
    const files = (await readdir(directory)).sort()
    expect(files).toHaveLength(3)
    for (const file of files) expect(file).toMatch(/^[a-f0-9]{64}\.bin$/)
    for (const versionId of ['a', 'b', 'c']) {
      const expected = {...identity, versionId}
      const location = await store.location(expected)
      const grant = await store.grant(expected)
      const bytes = new Uint8Array(
        await readFile(join(directory, `${location.bundle}.bin`))
      )
      expect(await sha256Hash(bytes)).toBe(location.bundle)
      expect(bytes).toEqual((await store.ciphertext(expected)).slice())
      expect(location.offset).toBe(0)
      expect(
        new TextDecoder().decode(
          await decryptFrame(expected, grant.descriptor, bytes, grant.key)
        )
      ).toBe(`PRIVATE ${versionId}`)
    }
    const before = await Promise.all(
      files.map(file => stat(join(directory, file)))
    )
    expect(await exportFrameBundles(db, directory, {targetBytes: 1})).toEqual(
      exported
    )
    const after = await Promise.all(
      files.map(file => stat(join(directory, file)))
    )
    expect(after.map(file => [file.ino, file.mtimeMs])).toEqual(
      before.map(file => [file.ino, file.mtimeMs])
    )
    expect((await readdir(directory)).sort()).toEqual(files)
    expect((await exportFrameBundles(db, directory)).bundles).toBe(1)
    for (const versionId of ['a', 'b', 'c']) {
      const expected = {...identity, versionId}
      const location = await store.location(expected)
      const grant = await store.grant(expected)
      const bundle = await readFile(join(directory, `${location.bundle}.bin`))
      expect(
        new Uint8Array(
          bundle.subarray(
            location.offset,
            location.offset + grant.descriptor.ciphertextLength
          )
        )
      ).toEqual((await store.ciphertext(expected)).slice())
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('failed publication preserves the prior SQL manifest and never overwrites a conflicting public file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-bundle-failure-'))
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await FrameStore.createSchema(db)
  const store = new FrameStore(db)
  try {
    for (const versionId of ['a', 'b', 'c'])
      await store.put(
        {...identity, versionId},
        new Uint8Array([versionId.charCodeAt(0)])
      )
    await exportFrameBundles(db, directory)
    const before = await db
      .select()
      .from(FrameLocationTable)
      .orderBy(FrameLocationTable.id)
    const rows = await db
      .select({ciphertext: FrameTable.ciphertext})
      .from(FrameTable)
      .orderBy(FrameTable.id)
    const filename = `${await sha256Hash(rows.at(-1)!.ciphertext)}.bin`
    await writeFile(join(directory, filename), 'conflicting file')
    await expect(
      exportFrameBundles(db, directory, {targetBytes: 1})
    ).rejects.toThrow('does not match')
    expect(
      await db.select().from(FrameLocationTable).orderBy(FrameLocationTable.id)
    ).toEqual(before)
    expect(await readFile(join(directory, filename), 'utf8')).toBe(
      'conflicting file'
    )
    expect(
      (await readdir(directory)).some(name => name.startsWith('.bundle-'))
    ).toBe(false)
    for (const row of before)
      expect(await stat(join(directory, `${row.bundle}.bin`))).toBeDefined()
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
