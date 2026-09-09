import {expect, spyOn, test} from 'bun:test'
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field as Fields} from '#/index.js'
import {Field} from '#/core/Field.js'
import {Entry} from '#/core/Entry.js'
import {VersionParser} from '#/core/db/EntryIndex.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {NodeReplica} from './NodeReplica.js'
import {children} from '#/query.js'
import {Policy, role} from '#/core/Role.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import type {GraphQuery, AnyQueryResult} from '#/core/Graph.js'
import {FrameStore} from '../release/FrameStore.js'
import {entryVersionId} from '../entry/Schema.js'

const Page = Config.document('Page', {fields: {title: Fields.text('Title')}})
const config = {
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
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

async function fixture(title: string) {
  return createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title},
    {id: 'b', type: 'Page', index: 'b', title: 'Child', parentPaths: ['a']}
  ])
}

test('payload batches enforce their aggregate byte budget before fetching ciphertext', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-payload-budget-'))
  const baseline = await fixture('Original')
  const scoped = {
    ...config,
    roles: {
      reader: role('Reader', {
        permissions(policy) {
          policy.allowAll()
        }
      })
    }
  }
  const replica = await NodeReplica.open(
    {directory, config: scoped, identity},
    baseline.source
  )
  const original = FrameStore.prototype.grant
  const grant = spyOn(FrameStore.prototype, 'grant').mockImplementation(
    async function (this: FrameStore, binding) {
      const value = await original.call(this, binding)
      return {
        ...value,
        descriptor: {...value.descriptor, ciphertextLength: 20 * 1024 * 1024}
      }
    }
  )
  const ciphertext = spyOn(FrameStore.prototype, 'ciphertext')
  try {
    const view = await replica.bootstrap('user', ['reader'])
    await expect(
      replica.payloads('user', ['reader'], {
        identity: view.identity,
        revision: view.revision,
        requests: view.entries.map(({entry, payloadId}) => ({
          versionId: entryVersionId(
            entry.id,
            entry.locale,
            entry.versionStatus
          ),
          payloadId: payloadId!
        }))
      })
    ).rejects.toThrow('byte limit')
    expect(ciphertext).not.toHaveBeenCalled()
  } finally {
    grant.mockRestore()
    ciphertext.mockRestore()
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('authenticated index bootstrap binds policy, rows and identity to one leased snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-index-bootstrap-'))
  const baseline = await fixture('Original')
  const updated = await fixture('Updated')
  const queried = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const scoped = {
    ...config,
    roles: {
      reader: role('Reader', {
        async permissions(policy, graph) {
          const title = await graph.first({id: 'a', select: Entry.title})
          queried.resolve()
          await resume.promise
          if (title === 'Original')
            policy.set(
              {id: 'a', allow: {explore: true, read: true}},
              {id: 'b', deny: {explore: true}}
            )
        }
      })
    }
  }
  const replica = await NodeReplica.open(
    {directory, config: scoped, identity},
    baseline.source
  )
  try {
    const roles = ['reader']
    const pending = replica.bootstrap('user', roles)
    roles.length = 0
    await queried.promise
    await replica.sync(updated.source)
    await replica.close()
    resume.resolve()
    const view = await pending
    expect(view.identity).toEqual({
      ...identity,
      principal: 'user',
      viewId: expect.any(String)
    })
    expect(view.revision).toBe((await baseline.source.getTree()).sha)
    expect(view.entries.map(row => row.entry.id)).toEqual(['a'])
    expect(view.entries[0].entry.title).toBe('Original')
    expect(view.entries[0]).not.toHaveProperty('data')
    await expect(replica.bootstrap('user', ['reader'])).rejects.toThrow(
      'closed'
    )
    await expect(replica.bootstrap('', [])).rejects.toThrow('principal')
  } finally {
    resume.resolve()
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('accepted commits atomically advance the SQL cache without writing the source', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-accepted-commit-'))
  const baseline = await fixture('Original')
  const options = {directory, config, identity}
  let replica = await NodeReplica.open(options, baseline.source)
  try {
    const request = await replica.request(
      [
        {
          op: 'update',
          id: 'a',
          locale: null,
          status: 'published',
          set: {title: 'Accepted'}
        }
      ],
      Policy.ALLOW_ALL
    )
    const pointer = await readFile(join(directory, 'current.json'), 'utf8')
    const corrupt = structuredClone(request)
    const added = corrupt.changes.find(change => change.op === 'addContent')!
    if (added.op === 'addContent') added.contents += 'invalid'
    await expect(replica.acceptCommit(corrupt)).rejects.toThrow(
      'blob hash mismatch'
    )
    await expect(
      replica.acceptCommit({...request, intoSha: 'invalid'})
    ).rejects.toThrow('target revision mismatch')
    await expect(
      replica.acceptCommit({...request, fromSha: 'stale'})
    ).rejects.toThrow('SHA mismatch')
    expect(await readFile(join(directory, 'current.json'), 'utf8')).toBe(
      pointer
    )
    expect(await replica.first({id: 'a', select: Entry.title})).toBe('Original')
    expect(await replica.acceptCommit(request)).toEqual({sha: request.intoSha})
    const acceptedPointer = await readFile(
      join(directory, 'current.json'),
      'utf8'
    )
    expect(await replica.acceptCommit(request)).toEqual({sha: request.intoSha})
    expect(await readFile(join(directory, 'current.json'), 'utf8')).toBe(
      acceptedPointer
    )
    expect(await replica.first({id: 'a', select: Entry.title})).toBe('Accepted')
    expect((await baseline.source.getTree()).sha).toBe(request.fromSha)
    expect((await replica.getTree()).sha).toBe(request.intoSha)
    expect(await replica.getTreeIfDifferent(request.intoSha)).toBeUndefined()
    await replica.close()
    replica = await NodeReplica.open(options, baseline.source)
    expect(replica.revision).toBe(request.intoSha)
    expect(await replica.first({id: 'a', select: Entry.title})).toBe('Accepted')
    await replica.close()
    await expect(replica.acceptCommit(request)).rejects.toThrow('closed')
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('source blob streams retain their generation across sync, close and cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-source-lease-'))
  const baseline = await fixture('Original')
  const updated = await fixture('Updated')
  const replica = await NodeReplica.open(
    {directory, config, identity},
    baseline.source
  )
  try {
    const tree = await baseline.source.getTree()
    const shas = [...new Set(tree.index().values())]
    const expected = await Array.fromAsync(baseline.source.getBlobs(shas))
    const stream = replica.getBlobs(shas)
    const first = await stream.next()
    expect(first.value).toEqual(expected[0])
    await replica.sync(updated.source)
    const controller = new AbortController()
    const cancelled = replica.getBlobs(shas, {signal: controller.signal})
    // Lease the current snapshot before retiring it.
    await cancelled.next()
    await replica.close()
    expect([first.value, ...(await Array.fromAsync(stream))]).toEqual(expected)
    controller.abort()
    await expect(cancelled.next()).rejects.toThrow()
    await expect(replica.getTree()).rejects.toThrow('closed')
    await expect(replica.getBlobs(shas).next()).rejects.toThrow('closed')
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('an accepted commit cannot overwrite a newer queued remote snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-commit-race-'))
  const baseline = await fixture('Original')
  const newer = await fixture('Newer remote revision')
  const replica = await NodeReplica.open(
    {directory, config, identity},
    baseline.source
  )
  try {
    const request = await replica.request(
      [
        {
          op: 'update',
          id: 'a',
          locale: null,
          status: 'published',
          set: {title: 'Earlier commit'}
        }
      ],
      Policy.ALLOW_ALL
    )
    const sync = replica.sync(newer.source)
    const commit = replica.acceptCommit(request)
    await expect(commit).rejects.toThrow('SHA mismatch')
    expect(await sync).toBe(true)
    expect(replica.revision).toBe((await newer.source.getTree()).sha)
    expect(await replica.first({id: 'a', select: Entry.title})).toBe(
      'Newer remote revision'
    )
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('packaged baselines open without copying or parsing and fork only for live deltas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-packaged-replica-'))
  const packaged = join(directory, 'release.sqlite')
  const baseline = await fixture('Bundled')
  const updated = await fixture('Live')
  const builder = await NodeReplica.open(
    {config, identity, directory: join(directory, 'builder')},
    baseline.source
  )
  await builder.captureCheckpoint(packaged)
  await builder.close()
  const options = {config, identity, directory: join(directory, 'working')}
  const parse = spyOn(VersionParser.prototype, 'parse')
  let working: NodeReplica | undefined
  try {
    const before = await readFile(packaged)
    working = await NodeReplica.open(options, {checkpoint: packaged})
    expect(await working.first({id: 'a', select: Entry.title})).toBe('Bundled')
    expect(parse).not.toHaveBeenCalled()
    expect(await readdir(options.directory)).toEqual([])
    expect(await working.sync(baseline.source)).toBe(false)
    expect(parse).not.toHaveBeenCalled()
    expect(await readdir(options.directory)).toEqual([])
    const entry = await working.get({id: 'a', select: Entry})
    expect(
      await working.first({
        id: 'a',
        select: Entry.title,
        preview: {
          entry: {
            ...entry,
            fileHash: 'preview',
            data: {...entry.data, title: 'Preview'}
          }
        }
      })
    ).toBe('Preview')
    expect(await readdir(options.directory)).toEqual([])
    parse.mockClear()
    expect(await working.sync(updated.source)).toBe(true)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(await working.first({id: 'a', select: Entry.title})).toBe('Live')
    expect(await readFile(packaged)).toEqual(before)
    const pointer = await readFile(
      join(options.directory, 'current.json'),
      'utf8'
    )
    await working.close()
    working = await NodeReplica.open(options, {checkpoint: packaged})
    expect(await working.first({id: 'a', select: Entry.title})).toBe('Live')
    await expect(
      NodeReplica.open(
        {...options, identity: {...identity, releaseId: 'different'}},
        {checkpoint: packaged}
      )
    ).rejects.toThrow('releaseId mismatch')
    expect(
      await readFile(join(options.directory, 'current.json'), 'utf8')
    ).toBe(pointer)
    const otherBuilder = await NodeReplica.open(
      {
        config,
        identity: {...identity, releaseId: 'different'},
        directory: join(directory, 'other-builder')
      },
      baseline.source
    )
    const otherPackage = join(directory, 'other-release.sqlite')
    await otherBuilder.captureCheckpoint(otherPackage)
    await otherBuilder.close()
    await working.close()
    working = await NodeReplica.open(
      {...options, identity: {...identity, releaseId: 'different'}},
      {checkpoint: otherPackage}
    )
    expect(await working.first({id: 'a', select: Entry.title})).toBe('Bundled')
    expect(await readFile(packaged)).toEqual(before)
  } finally {
    parse.mockRestore()
    await working?.close()
    await builder.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('Node mutation preparation cleans scratch files and preserves the published snapshot until source commit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-mutation-'))
  const baseline = await fixture('Original')
  const replica = await NodeReplica.open(
    {directory, config, identity},
    baseline.source
  )
  try {
    const files = (await readdir(directory)).sort()
    const pointer = await readFile(join(directory, 'current.json'), 'utf8')
    const request = await replica.request(
      [
        {
          op: 'update',
          id: 'a',
          locale: null,
          status: 'published',
          set: {title: 'Updated'}
        }
      ],
      Policy.ALLOW_ALL
    )
    expect(replica.revision).toBe(request.fromSha)
    expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
      'Original'
    ])
    expect(await readFile(join(directory, 'current.json'), 'utf8')).toBe(
      pointer
    )
    expect((await readdir(directory)).sort()).toEqual(files)
    await expect(
      replica.request(
        [
          {
            op: 'update',
            id: 'a',
            locale: null,
            status: 'published',
            set: {title: 'Denied'}
          }
        ],
        Policy.ALLOW_NONE
      )
    ).rejects.toThrow()
    expect((await readdir(directory)).sort()).toEqual(files)
    await expect(
      replica.request(
        [
          {
            op: 'update',
            id: 'missing',
            locale: null,
            status: 'published',
            set: {title: 'Invalid'}
          }
        ],
        Policy.ALLOW_ALL
      )
    ).rejects.toThrow('Entry not found')
    expect((await readdir(directory)).sort()).toEqual(files)
    await baseline.source.applyChanges(sourceChanges(request))
    await replica.sync(baseline.source)
    expect(replica.revision).toBe(request.intoSha)
    expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
      'Updated'
    ])
    await replica.close()
    await expect(replica.request([], Policy.ALLOW_ALL)).rejects.toThrow(
      'closed'
    )
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('closing a replica drains in-flight preparation without returning a request or publishing it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-mutation-close-'))
  const baseline = await fixture('Original')
  const replica = await NodeReplica.open(
    {directory, config, identity},
    baseline.source
  )
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const resolve = EntryRuntime.prototype.resolve
  let hold = true
  const resolving = spyOn(EntryRuntime.prototype, 'resolve').mockImplementation(
    async function <Query extends GraphQuery>(
      this: EntryRuntime,
      query: Query
    ): Promise<AnyQueryResult<Query>> {
      if (hold) {
        hold = false
        started.resolve()
        await resume.promise
      }
      return resolve.bind(this)<Query>(query)
    }
  )
  try {
    const files = (await readdir(directory)).sort()
    const pending = replica
      .request(
        [
          {
            op: 'update',
            id: 'a',
            locale: null,
            status: 'published',
            set: {title: 'Updated'}
          }
        ],
        Policy.ALLOW_ALL
      )
      .then(
        () => 'returned',
        error => String(error)
      )
    await started.promise
    expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
      'Original'
    ])
    const closing = replica.close()
    resume.resolve()
    expect(await pending).toContain('closed')
    await closing
    expect((await readdir(directory)).sort()).toEqual(files)
    const reopened = await NodeReplica.open(
      {directory, config, identity},
      baseline.source
    )
    try {
      expect(await reopened.find({id: 'a', select: Entry.title})).toEqual([
        'Original'
      ])
    } finally {
      await reopened.close()
    }
  } finally {
    resume.resolve()
    resolving.mockRestore()
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('Node replica restores its cache without parsing and publishes only validated replacements', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-replica-'))
  const first = await fixture('First')
  const second = await fixture('Second')
  const options = {directory, config, identity}
  try {
    const initial = await NodeReplica.open(options, first.source)
    expect(await initial.find({id: 'a', select: Entry.title})).toEqual([
      'First'
    ])
    await initial.close()
    const parse = spyOn(VersionParser.prototype, 'parse')
    try {
      const replica = await NodeReplica.open(
        {...options, identity: {...identity, releaseId: 'new-build-id'}},
        second.source
      )
      try {
        expect(parse).not.toHaveBeenCalled()
        expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
          'First'
        ])
        expect(await replica.sync(second.source)).toBe(true)
        expect(parse).toHaveBeenCalledTimes(1)
        expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
          'Second'
        ])
        const pointer = await readFile(join(directory, 'current.json'), 'utf8')
        expect(await replica.sync(second.source)).toBe(false)
        expect(await readFile(join(directory, 'current.json'), 'utf8')).toBe(
          pointer
        )
        await expect(
          replica.sync({
            getTreeIfDifferent: first.source.getTreeIfDifferent.bind(
              first.source
            ),
            async *getBlobs() {
              yield await Promise.reject<[string, Uint8Array]>(
                new Error('Source unavailable')
              )
            }
          })
        ).rejects.toThrow('Source unavailable')
        expect(await readFile(join(directory, 'current.json'), 'utf8')).toBe(
          pointer
        )
        expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
          'Second'
        ])
      } finally {
        await replica.close()
      }
    } finally {
      parse.mockRestore()
    }
    const differentConfig = await NodeReplica.open(
      {...options, identity: {...identity, configId: 'different'}},
      first.source
    )
    expect(await differentConfig.find({id: 'a', select: Entry.title})).toEqual([
      'First'
    ])
    await differentConfig.close()
    await writeFile(
      join(directory, 'current.json'),
      JSON.stringify({file: '../outside.sqlite', identity})
    )
    await expect(NodeReplica.open(options, first.source)).rejects.toThrow(
      'Invalid SQLite replica cache pointer'
    )
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('a query retains its snapshot through reader swaps and close, while subscriptions advance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-leases-'))
  const first = await fixture('First')
  const second = await fixture('Second')
  const replica = await NodeReplica.open(
    {directory, config, identity},
    first.source
  )
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const queryValue = Field.queryValue
  const process = spyOn(Field, 'queryValue').mockImplementation(
    async (field, value, context) => {
      if (value === 'First') {
        started.resolve()
        await release.promise
      }
      return queryValue(field, value, context)
    }
  )
  try {
    const initial = Promise.withResolvers<unknown>()
    const updated = Promise.withResolvers<unknown>()
    let deliveries = 0
    const stop = replica.subscribe(
      {id: 'a', select: Entry.title},
      {
        next(value) {
          ;(++deliveries === 1 ? initial : updated).resolve(value)
        },
        error(error) {
          initial.reject(error)
          updated.reject(error)
        }
      }
    )
    expect(await initial.promise).toEqual(['First'])
    const pending = replica.find({
      id: 'a',
      select: {
        title: Page.title,
        children: children({select: Entry.title})
      }
    })
    await started.promise
    await replica.sync(second.source)
    expect(await updated.promise).toEqual(['Second'])
    expect(await replica.find({id: 'a', select: Entry.title})).toEqual([
      'Second'
    ])
    stop()
    await replica.close()
    await expect(replica.find({select: Entry.id})).rejects.toThrow('closed')
    release.resolve()
    expect(await pending).toEqual([{title: 'First', children: ['Child']}])
    expect(deliveries).toBe(2)
  } finally {
    release.resolve()
    process.mockRestore()
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('closing during source lookup prevents a pending replacement from publishing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-node-close-'))
  const first = await fixture('First')
  const second = await fixture('Second')
  const replica = await NodeReplica.open(
    {directory, config, identity},
    first.source
  )
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  try {
    const pointer = await readFile(join(directory, 'current.json'), 'utf8')
    const pending = replica
      .sync({
        async getTreeIfDifferent(sha) {
          started.resolve()
          await release.promise
          return second.source.getTreeIfDifferent(sha)
        },
        getBlobs: second.source.getBlobs.bind(second.source)
      })
      .then(
        () => undefined,
        error => error
      )
    await started.promise
    const closing = replica.close()
    release.resolve()
    expect(await pending).toBeInstanceOf(Error)
    await closing
    expect(await readFile(join(directory, 'current.json'), 'utf8')).toBe(
      pointer
    )
  } finally {
    release.resolve()
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})
