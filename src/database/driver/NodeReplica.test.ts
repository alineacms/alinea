import {expect, spyOn, test} from 'bun:test'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field as Fields} from '#/index.js'
import {Field} from '#/core/Field.js'
import {Entry} from '#/core/Entry.js'
import {VersionParser} from '#/core/db/EntryIndex.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {NodeReplica} from './NodeReplica.js'
import {children} from '#/query.js'

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
