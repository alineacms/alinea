import type {Config} from '#/core/Config.js'
import {Config as ConfigUtils} from '#/core/Config.js'
import type {EntryStatus} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {buildEntryDatabase} from '#/database/entry/Source.js'
import {DatabaseResolver} from '#/database/query/Resolver.js'

export interface EntryFixtureEntry {
  id: string
  type: string
  index: string
  data?: Record<string, unknown>
  title?: string
  path?: string
  status?: EntryStatus
  workspace?: string
  root?: string
  locale?: string | null
  parentPaths?: Array<string>
  seeded?: string | null
}

export interface DatabaseResolverFixture {
  source: MemorySource
  resolver: DatabaseResolver
}

function defaultWorkspace(config: Config) {
  const [workspace] = Object.keys(config.workspaces)
  if (!workspace) throw new Error('Config has no workspaces')
  return workspace
}

function defaultRoot(config: Config, workspace: string) {
  const [root] = Object.keys(config.workspaces[workspace])
  if (!root) throw new Error(`Workspace "${workspace}" has no roots`)
  return root
}

function filePathFor(
  config: Config,
  input: {
    workspace: string
    root: string
    locale: string | null
    parentPaths: Array<string>
    path: string
    status: EntryStatus
  }
) {
  const file = [...input.parentPaths, input.path].join('/')
  const suffix = input.status === 'published' ? '' : `.${input.status}`
  return ConfigUtils.filePath(
    config,
    input.workspace,
    input.root,
    input.locale,
    `${file}${suffix}.json`
  )
}

export async function createEntrySource(
  config: Config,
  entries: Array<EntryFixtureEntry>
): Promise<MemorySource> {
  const source = new MemorySource()
  const changes = await Promise.all(
    entries.map(async input => {
      const workspace = input.workspace ?? defaultWorkspace(config)
      const root = input.root ?? defaultRoot(config, workspace)
      const locale = input.locale ?? null
      const status = input.status ?? 'published'
      const parentPaths = input.parentPaths ?? []
      const path =
        input.path ??
        (typeof input.data?.path === 'string' ? input.data.path : input.id)
      const title =
        input.title ??
        (typeof input.data?.title === 'string' ? input.data.title : path)
      const data = {...input.data, path, title}
      const record = createRecord(
        {
          id: input.id,
          type: input.type,
          index: input.index,
          parentId: parentPaths.length > 0 ? '__parent__' : null,
          root,
          path,
          title,
          seeded: input.seeded ?? null,
          data
        },
        status
      )
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      const sha = await hashBlob(contents)
      return {
        op: 'add' as const,
        path: filePathFor(config, {
          workspace,
          root,
          locale,
          parentPaths,
          path,
          status
        }),
        sha,
        contents
      }
    })
  )
  const tree = await source.getTree()
  await source.applyChanges({
    fromSha: tree.sha,
    changes
  })
  return source
}

export async function createDatabaseResolver(
  config: Config,
  entries: Array<EntryFixtureEntry>
): Promise<DatabaseResolverFixture> {
  const source = await createEntrySource(config, entries)
  const database = await buildEntryDatabase(config, source)
  const resolver = new DatabaseResolver(config, database)
  return {source, resolver}
}
