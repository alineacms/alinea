import {expect, spyOn, test} from 'bun:test'
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {DatabaseSync} from 'node:sqlite'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {embeddingHash, type EmbeddingSpace} from '../vector/Embedding.js'
import {EmbeddingStore} from '../vector/EmbeddingStore.js'
import {NodeReplica} from './NodeReplica.js'
import {nodeDatabase} from './NodeDatabase.js'

const space: EmbeddingSpace = {
  provider: 'fixture',
  model: 'text',
  revision: '1',
  preprocessing: 'searchable-v1',
  dimensions: 2,
  metric: 'cosine',
  encoding: 'float32-le'
}
const config = {
  schema: {
    Page: Config.document('Page', {
      fields: {title: Field.text('Title', {searchable: true})}
    })
  },
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
    })
  },
  embeddings: {semantic: {source: 'searchableText' as const, space}}
}
const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

async function fixture(title = 'Original', extra = false) {
  return createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title},
    {id: 'b', type: 'Page', index: 'b', title: 'Retained'},
    ...(extra ? [{id: 'c', type: 'Page', index: 'c', title: 'New'}] : [])
  ])
}
async function currentPath(directory: string) {
  const pointer = JSON.parse(
    await readFile(join(directory, 'current.json'), 'utf8')
  ) as {file: string}
  return join(directory, pointer.file)
}

test('a failed completion merge never publishes a partially updated generation', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'alinea-node-embedding-merge-')
  )
  let replica: NodeReplica | undefined
  const install = EmbeddingStore.prototype.install
  let calls = 0
  const merging = spyOn(EmbeddingStore.prototype, 'install').mockImplementation(
    function (this: EmbeddingStore, job, vector, signal) {
      if (++calls === 4)
        return Promise.reject(new Error('Injected merge failure'))
      return install.call(this, job, vector, signal)
    }
  )
  try {
    replica = await NodeReplica.open(
      {config, directory, identity},
      (await fixture()).source
    )
    const path = await currentPath(directory),
      before = await readFile(path),
      revision = await replica.embeddingRevision()
    const spaceId = await embeddingHash(space)
    await expect(
      replica.runEmbeddings({
        space,
        async embed() {
          return {spaceId, vector: [1, 0]}
        }
      })
    ).rejects.toThrow('Injected merge failure')
    expect(calls).toBe(4)
    expect(await currentPath(directory)).toBe(path)
    expect(await readFile(path)).toEqual(before)
    expect(await replica.embeddingRevision()).toBe(revision)
    expect(
      (await readdir(directory)).some(
        file => file.startsWith('.embedding-') || file.startsWith('.pending-')
      )
    ).toBe(false)
  } finally {
    merging.mockRestore()
    await replica?.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('a fully superseded background batch does not replace the new source generation', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'alinea-node-embedding-obsolete-')
  )
  let replica: NodeReplica | undefined
  const resume = Promise.withResolvers<void>()
  try {
    replica = await NodeReplica.open(
      {config, directory, identity},
      (await fixture()).source
    )
    const started = Promise.withResolvers<void>(),
      spaceId = await embeddingHash(space)
    const running = replica.runEmbeddings(
      {
        space,
        async embed() {
          started.resolve()
          await resume.promise
          return {spaceId, vector: [1, 0]}
        }
      },
      {concurrency: 1}
    )
    await started.promise
    await replica.sync((await createEntryResolver(config, [])).source)
    const path = await currentPath(directory),
      revision = await replica.embeddingRevision()
    resume.resolve()
    expect((await running).every(result => result.status === 'obsolete')).toBe(
      true
    )
    expect(await currentPath(directory)).toBe(path)
    expect(await replica.embeddingRevision()).toBe(revision)
    expect(await replica.find({select: Entry.id})).toEqual([])
  } finally {
    resume.resolve()
    await replica?.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('background providers do not block source updates; only current completions merge into a new immutable generation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-embeddings-'))
  const original = await fixture(),
    edited = await fixture('Changed', true)
  let replica: NodeReplica | undefined
  const resume = Promise.withResolvers<void>()
  try {
    replica = await NodeReplica.open(
      {config, directory, identity},
      original.source
    )
    const originalPath = await currentPath(directory),
      originalBytes = await readFile(originalPath)
    const started = Promise.withResolvers<void>(),
      spaceId = await embeddingHash(space)
    let calls = 0
    const running = replica.runEmbeddings({
      space,
      async embed() {
        if (++calls === 2) started.resolve()
        await resume.promise
        return {spaceId, vector: [1, 0]}
      }
    })
    await started.promise
    await expect(
      replica.runEmbeddings({
        space,
        async embed() {
          throw new Error('unexpected')
        }
      })
    ).rejects.toThrow('already running')
    expect(await replica.sync(edited.source)).toBe(true)
    expect(await replica.find({select: Entry.title})).toEqual([
      'Changed',
      'Retained',
      'New'
    ])
    const beforeCompletion = await replica.embeddingRevision()
    const sourceRevision = replica.revision
    const live = Promise.withResolvers<void>()
    const initial = Promise.withResolvers<void>()
    let emissions = 0
    const unsubscribe = replica.subscribe(
      {select: Entry.title},
      {
        next() {
          if (++emissions === 1) initial.resolve()
          else live.resolve()
        },
        error: live.reject
      }
    )
    await initial.promise
    resume.resolve()
    const results = await running
    expect(
      results.filter(result => result.status === 'installed')
    ).toHaveLength(1)
    expect(results.filter(result => result.status === 'obsolete')).toHaveLength(
      1
    )
    await live.promise
    unsubscribe()
    expect(replica.revision).toBe(sourceRevision)
    expect(await replica.embeddingRevision()).not.toBe(beforeCompletion)
    expect(await readFile(originalPath)).toEqual(originalBytes)
    const path = await currentPath(directory)
    using sqlite = new DatabaseSync(path, {readOnly: true})
    const store = new EmbeddingStore(nodeDatabase(sqlite))
    const installed = results.find(result => result.status === 'installed')!
    const manifest = (await store.manifest(installed.id))!
    expect(await store.load(manifest)).toEqual([1, 0])
    expect(await store.pending(spaceId)).toHaveLength(2)
    const completedRevision = await replica.embeddingRevision()
    await replica.close()
    replica = await NodeReplica.open(
      {config, directory, identity},
      edited.source
    )
    expect(await replica.embeddingRevision()).toBe(completedRevision)
    expect(await replica.find({select: Entry.title})).toEqual([
      'Changed',
      'Retained',
      'New'
    ])
    expect(
      (await readdir(directory)).some(
        file => file.startsWith('.embedding-') || file.startsWith('.pending-')
      )
    ).toBe(false)
  } finally {
    resume.resolve()
    await replica?.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('failed providers leave the published generation unchanged and explicit retry publishes derived state', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'alinea-node-embedding-retry-')
  )
  let replica: NodeReplica | undefined
  try {
    replica = await NodeReplica.open(
      {config, directory, identity},
      (await fixture()).source
    )
    const path = await currentPath(directory),
      revision = await replica.embeddingRevision()
    const failures = await replica.runEmbeddings({
      space,
      async embed() {
        throw new Error('Provider unavailable')
      }
    })
    expect(failures.every(result => result.status === 'failed')).toBe(true)
    expect(await currentPath(directory)).toBe(path)
    expect(await replica.embeddingRevision()).toBe(revision)
    const spaceId = await embeddingHash(space)
    const provider = {
      space,
      async embed() {
        return {spaceId, vector: [1, 0]}
      }
    }
    expect(
      (await replica.runEmbeddings(provider)).every(
        result => result.status === 'installed'
      )
    ).toBe(true)
    const next = await currentPath(directory)
    expect(next).not.toBe(path)
    expect(await replica.runEmbeddings(provider)).toEqual([])
    expect(await currentPath(directory)).toBe(next)
  } finally {
    await replica?.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('closing aborts background providers, drains scratch cleanup and cannot publish late output', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'alinea-node-embedding-close-')
  )
  let replica: NodeReplica | undefined
  try {
    replica = await NodeReplica.open(
      {config, directory, identity},
      (await fixture()).source
    )
    const path = await currentPath(directory),
      started = Promise.withResolvers<void>()
    let calls = 0
    const running = replica.runEmbeddings(
      {
        space,
        async embed(_input, signal) {
          calls++
          started.resolve()
          await new Promise<void>((_, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true
            })
          )
          throw new Error('Unexpected provider continuation')
        }
      },
      {concurrency: 1}
    )
    const settled = running.then(
      () => undefined,
      error => error as Error
    )
    await started.promise
    const closing = replica.close()
    expect(replica.close()).toBe(closing)
    await closing
    expect((await settled)?.message).toContain('closed')
    expect(calls).toBe(1)
    expect(await currentPath(directory)).toBe(path)
    expect(
      (await readdir(directory)).some(file => file.startsWith('.embedding-'))
    ).toBe(false)
    await expect(
      replica.runEmbeddings({
        space,
        async embed() {
          throw new Error('unexpected')
        }
      })
    ).rejects.toThrow('closed')
  } finally {
    await replica?.close()
    await rm(directory, {recursive: true, force: true})
  }
})
