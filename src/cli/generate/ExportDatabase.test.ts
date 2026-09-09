import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {EntryGraph, VersionParser} from '#/core/db/EntryIndex.js'
import {importSource} from '#/core/source/SourceExport.js'
import {NodeReplica} from '#/database/driver/NodeReplica.js'
import {openCheckpoint} from '#/database/runtime/Checkpoint.js'
import {FrameStore} from '#/database/release/FrameStore.js'
import {entryVersionId} from '#/database/entry/Schema.js'
import {decryptFrame} from '#/database/replica/Frame.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {execFile} from 'node:child_process'
import {
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {exportDatabase} from './ExportDatabase.js'

test('release export captures one generation and rebinds frames without source normalization', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-captured-release-'))
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
    releaseId: 'cache'
  }
  const initial = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Captured'}
  ])
  const changed = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Later'}
  ])
  const replica = await NodeReplica.open(
    {config, directory: join(directory, 'cache'), identity},
    initial.source
  )
  let restore = () => {}
  try {
    const occupied = join(directory, 'occupied')
    await writeFile(occupied, 'keep')
    await expect(replica.captureCheckpoint(occupied)).rejects.toThrow()
    expect(await readFile(occupied, 'utf8')).toBe('keep')
    const release = {...identity, releaseId: 'deployment'}
    await expect(
      exportDatabase(
        config,
        replica,
        directory,
        {...release, configId: 'wrong'},
        join(directory, 'public')
      )
    ).rejects.toThrow('configId mismatch')
    expect(await replica.first({select: Entry.title})).toBe('Captured')
    const capturedSource = {
      async captureCheckpoint(file: string) {
        const capture = await replica.captureCheckpoint(file)
        await replica.sync(changed.source)
        expect(await replica.first({select: Entry.title})).toBe('Later')
        await replica.close()
        const graph = spyOn(EntryGraph, 'fromParsed').mockImplementation(() => {
          throw new Error('Unexpected release normalization')
        })
        const parser = spyOn(
          VersionParser.prototype,
          'parse'
        ).mockImplementation(() => {
          throw new Error('Unexpected release parsing')
        })
        restore = () => {
          graph.mockRestore()
          parser.mockRestore()
        }
        return capture
      }
    }
    await exportDatabase(
      config,
      capturedSource,
      directory,
      release,
      join(directory, 'public')
    )
    const loader = await import(
      pathToFileURL(join(directory, 'database.js')).href
    )
    using sqlite = new Database(loader.databasePath, {readonly: true})
    const db = connect(sqlite)
    const {runtime, descriptor} = await openCheckpoint(config, db, release)
    expect(await runtime.first({select: Entry.title})).toBe('Captured')
    expect(descriptor.sourceSha).toBe((await initial.source.getTree()).sha)
    const sourceModule = await import(
      pathToFileURL(join(directory, 'source.js')).href
    )
    const legacy = await importSource(sourceModule.source)
    expect((await legacy.getTree()).sha).toBe(descriptor.sourceSha)
    const row = (await runtime.indexSnapshot()).entries[0]
    const frame = {
      ...release,
      versionId: entryVersionId('a', null, 'published'),
      payloadId: row.payloadId!,
      kind: 'data' as const
    }
    const store = new FrameStore(db)
    const grant = await store.grant(frame)
    const decoded = JSON.parse(
      new TextDecoder().decode(
        await decryptFrame(
          frame,
          grant.descriptor,
          await store.ciphertext(frame),
          grant.key
        )
      )
    )
    expect(decoded.data.title).toBe('Captured')
    await expect(
      store.grant({...frame, releaseId: identity.releaseId})
    ).rejects.toThrow('Missing release')
    await expect(
      replica.captureCheckpoint(join(directory, 'closed'))
    ).rejects.toThrow('closed')
  } finally {
    restore()
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('rebuilds switch one loader while retained readers and failed builds keep their checkpoint', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-rebuild-'))
  try {
    const identity = {
      project: 'project',
      epoch: 'epoch',
      schemaId: 'schema',
      configId: 'config',
      releaseId: 'first',
      namespace: 'main'
    }
    const source = new FSSource('test/fixtures/demo')
    const publish = (
      releaseId: string,
      publicDir = join(directory, 'public')
    ) =>
      exportDatabase(
        cms.config,
        source,
        directory,
        {...identity, releaseId},
        publicDir
      )
    await publish('first')
    const original = await readFile(join(directory, 'database.js'), 'utf8')
    await writeFile(join(directory, 'retained.js'), original)
    const invalidPublicDir = join(directory, 'not-a-directory')
    await writeFile(invalidPublicDir, 'publication must fail')
    await expect(publish('failed', invalidPublicDir)).rejects.toThrow()
    expect(await readFile(join(directory, 'database.js'), 'utf8')).toBe(
      original
    )
    expect(await readdir(join(directory, 'checkpoints'))).toHaveLength(1)
    await publish('second')
    expect(await readdir(join(directory, 'checkpoints'))).toHaveLength(2)
    const {stdout} = await promisify(execFile)('node', [
      '--input-type=module',
      '-e',
      `
      import {DatabaseSync} from 'node:sqlite';
      const results = [];
      for (const file of ['retained.js', 'database.js']) {
        const loader = await import(new URL(file, ${JSON.stringify(pathToFileURL(`${directory}/`).href)}));
        const db = new DatabaseSync(loader.databasePath, {readOnly: true});
        results.push([loader.identity.releaseId, db.prepare('select releaseId from alinea_checkpoint').get().releaseId]);
        db.close();
      }
      console.log(JSON.stringify(results));`
    ])
    expect(JSON.parse(stdout)).toEqual([
      ['first', 'first'],
      ['second', 'second']
    ])
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('exports a self-contained checkpoint and relocatable loader readable by Node', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-export-'))
  const relocated = `${directory}-relocated`
  try {
    const identity = {
      project: 'project',
      epoch: 'epoch',
      schemaId: 'schema',
      configId: 'config-1',
      releaseId: 'release-1',
      namespace: 'main'
    }
    const size = await exportDatabase(
      cms.config,
      new FSSource('test/fixtures/demo'),
      directory,
      identity,
      join(directory, 'public')
    )
    expect(size).toBeGreaterThan(0)
    expect((await readdir(directory)).sort()).toEqual([
      'checkpoints',
      'database.js',
      'public',
      'source.js'
    ])
    const {nodeFileTrace} = createRequire(import.meta.url)(
      'next/dist/compiled/@vercel/nft'
    ) as {
      nodeFileTrace(
        files: Array<string>,
        options: {base: string}
      ): Promise<{fileList: Set<string>}>
    }
    const trace = await nodeFileTrace([join(directory, 'database.js')], {
      base: directory
    })
    expect(
      [...trace.fileList].some(file => file.endsWith('release.sqlite'))
    ).toBe(true)
    await rename(directory, relocated)
    const {stdout} = await promisify(execFile)('node', [
      '--input-type=module',
      '-e',
      `
      import {DatabaseSync} from 'node:sqlite';
      const loader = await import(${JSON.stringify(pathToFileURL(join(relocated, 'database.js')).href)});
      const db = new DatabaseSync(loader.databasePath, {readOnly: true});
      console.log(JSON.stringify({identity: loader.identity, payloadBasePath: loader.payloadBasePath, check: db.prepare('pragma integrity_check').get(), count: db.prepare('select count(*) as count from alinea_entry_index').get(), frames: db.prepare('select count(*) as count from alinea_release_frame').get(), locations: db.prepare('select count(*) as count from alinea_release_frame_location').get()}));
      db.close();
    `
    ])
    const result = JSON.parse(stdout)
    expect(result.identity).toEqual(identity)
    expect(result.check).toEqual({integrity_check: 'ok'})
    expect(result.count.count).toBeGreaterThan(0)
    expect(result.frames.count).toBe(result.count.count)
    expect(result.locations.count).toBe(result.count.count)
    expect(result.payloadBasePath).toBe('/_alinea/payloads/')
    const publicFiles = await readdir(join(relocated, 'public'))
    expect(publicFiles.length).toBeGreaterThan(0)
    for (const file of publicFiles) expect(file).toMatch(/^[a-f0-9]{64}\.bin$/)
  } finally {
    await rm(directory, {recursive: true, force: true})
    await rm(relocated, {recursive: true, force: true})
  }
})
