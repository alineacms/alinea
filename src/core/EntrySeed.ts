import {Config, type Config as ConfigType} from './Config.js'
import type {Mutation} from './db/Mutation.js'
import {Entry} from './Entry.js'
import type {Graph} from './Graph.js'
import {createId} from './Id.js'
import {getRoot} from './Internal.js'
import {Page, type Page as PageType} from './Page.js'
import {Schema} from './Schema.js'
import {assert} from './util/Assert.js'
import {entries} from './util/Objects.js'
import * as paths from './util/Paths.js'
import {slugify} from './util/Slugs.js'

export interface EntrySeed {
  id: string
  type: string
  workspace: string
  root: string
  locale: string | null
  filePath: string
  nodePath: string
  parentNodePath: string | null
  seedPath: string
  data: Record<string, unknown>
}

const cache = new WeakMap<ConfigType, ReadonlyArray<EntrySeed>>()

export function entrySeeds(config: ConfigType): ReadonlyArray<EntrySeed> {
  const cached = cache.get(config)
  if (cached) return cached
  const result = Array<EntrySeed>()
  const typeNames = Schema.typeNames(config.schema)
  const multipleWorkspaces = Config.multipleWorkspaces(config)
  for (const [workspaceName, workspace] of entries(config.workspaces)) {
    for (const [rootName, root] of entries(workspace)) {
      const locales = getRoot(root).i18n?.locales ?? [null]
      for (const locale of locales) {
        const pages: Array<readonly [string, PageType]> = entries(root)
        while (pages.length) {
          const [configuredPath, page] = pages.shift()!
          const path = configuredPath.split('/').map(slugify).join('/')
          if (!Page.isPage(page)) continue
          const {type, fields = {}} = Page.data(page)
          const typeName = typeNames.get(type)
          if (!typeName) continue
          const filePath = Config.filePath(
            config,
            workspaceName,
            rootName,
            locale,
            `${path}.json`
          )
          const nodePath = filePath.slice(0, -'.json'.length)
          const parentNodePath = path.includes('/')
            ? paths.dirname(nodePath)
            : null
          const pathSegments = nodePath
            .split('/')
            .slice(multipleWorkspaces ? 2 : 1)
          result.push({
            id: `${rootName}/${path}`,
            type: typeName,
            workspace: workspaceName,
            root: rootName,
            locale,
            filePath,
            nodePath,
            parentNodePath,
            seedPath: `/${pathSegments.join('/')}.json`,
            data: {
              ...(fields as Record<string, unknown>),
              path: path.split('/').at(-1),
              title: fields.title ?? path
            }
          })
          pages.push(
            ...entries(page).map(
              ([childPath, child]) =>
                [`${path}/${childPath}`, child as PageType] as const
            )
          )
        }
      }
    }
  }
  cache.set(config, result)
  return result
}

/** Plan the creations needed to materialize every configured seed. */
export async function seedMutations(
  graph: Graph,
  config: ConfigType
): Promise<Array<Mutation>> {
  const seeds = entrySeeds(config)
  const mutations = Array<Mutation>()
  if (!seeds.length) return mutations
  const nodeIds = new Map<string, string>()
  const translationIds = new Map<string, string>()
  const selection = {id: Entry.id, type: Entry.type}
  for (const seed of seeds) {
    const existingBySeed = await graph.first({
      seeded: seed.seedPath,
      workspace: seed.workspace,
      root: seed.root,
      locale: seed.locale,
      status: 'all',
      select: selection
    })
    const existing =
      existingBySeed ??
      (await graph.first({
        filePath: {
          in: [
            seed.filePath,
            seed.filePath.replace(/\.json$/, '.draft.json'),
            seed.filePath.replace(/\.json$/, '.archived.json')
          ]
        },
        status: 'all',
        select: selection
      }))
    if (existing) {
      assert(existing.type === seed.type, `Type mismatch in ${seed.nodePath}`)
      nodeIds.set(seed.nodePath, existing.id)
      translationIds.set(`${seed.workspace}/${seed.id}`, existing.id)
      continue
    }
    const translationKey = `${seed.workspace}/${seed.id}`
    const id = translationIds.get(translationKey) ?? createId()
    const parentId = seed.parentNodePath
      ? nodeIds.get(seed.parentNodePath)
      : null
    if (seed.parentNodePath)
      assert(parentId, `Missing seed parent ${seed.parentNodePath}`)
    translationIds.set(translationKey, id)
    nodeIds.set(seed.nodePath, id)
    mutations.push({
      op: 'create',
      id,
      parentId,
      locale: seed.locale,
      type: seed.type,
      workspace: seed.workspace,
      root: seed.root,
      fromSeed: seed.seedPath,
      data: {path: seed.data.path}
    })
  }
  return mutations
}

/**
 * The configured seed an entry file points to with `_seeded`, or undefined
 * when that seed was removed from the config (a stale marker).
 */
export function entrySeed(
  config: ConfigType,
  seedPath: string | null,
  location: Pick<EntrySeed, 'workspace' | 'root' | 'locale'>
): EntrySeed | undefined {
  if (!seedPath) return undefined
  return entrySeeds(config).find(
    seed =>
      seed.seedPath === seedPath &&
      seed.workspace === location.workspace &&
      seed.root === location.root &&
      seed.locale === location.locale
  )
}
