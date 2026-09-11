import {Config, type Config as ConfigType} from './Config.js'
import {getRoot} from './Internal.js'
import {Page, type Page as PageType} from './Page.js'
import {Schema} from './Schema.js'
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

export function seedData(
  config: ConfigType,
  seedPath: string | null,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!seedPath) return data
  const seed = entrySeeds(config).find(seed => seed.seedPath === seedPath)
  return seed ? {...seed.data, ...data} : data
}
