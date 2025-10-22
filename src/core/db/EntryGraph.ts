import {Config} from '../Config.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import type {Source} from '../source/Source.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo} from '../util/EntryFilenames.js'
import {keys} from '../util/Objects.js'
import {Workspace} from '../Workspace.js'

interface Version {
  id: string
  type: string
  index: string
  searchableText: string
  data: object
}

class EntryNode {
  id: string
  type: string
  index: string
  workspace: string
  root: string
  constructor(workspace: string, root: string, version: Version) {
    this.id = version.id
    this.type = version.type
    this.index = version.index
    this.workspace = workspace
    this.root = root
  }
}

class EntryGraph {
  #config: Config
  #singleWorkspace: string | undefined
  #nodes: Map<string, EntryNode> = new Map()
  constructor(
    config: Config,
    entries: Array<readonly [file: string, version: Version]>
  ) {
    this.#config = config
    const singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
    for (const [file, version] of entries) {
      const segments = file.toLowerCase().split('/')
      const baseName = segments.at(-1)
      assert(baseName)
      const lastDot = baseName.lastIndexOf('.')
      assert(lastDot !== -1)
      const fileName = baseName.slice(0, lastDot)
      const [path, status] = entryInfo(fileName)
      let segmentIndex = 0
      const workspace = singleWorkspace ?? segments[segmentIndex++]
      const workspaceConfig = this.#config.workspaces[workspace]
      assert(workspaceConfig, `Invalid workspace: ${workspace} in ${file}`)
      const root = segments[segmentIndex++]
      const rootConfig = workspaceConfig[root]
      assert(rootConfig, `Invalid root: ${root}`)
      const i18n = getRoot(rootConfig).i18n
      let locale: string | null = null
      if (i18n) {
        locale = segments[segmentIndex++]
        for (const localeCandidate of i18n.locales) {
          if (locale === localeCandidate.toLowerCase()) {
            locale = localeCandidate
            break
          }
        }
      }
      let node: EntryNode
      if (!this.#nodes.has(version.id)) {
        node = new EntryNode(workspace, root, version)
        this.#nodes.set(version.id, node)
      } else {
        node = this.#nodes.get(version.id)!
        if (node.type !== version.type) throw new Error(`err: type`)
        if (node.index !== version.index) throw new Error(`err: index`)
        if (node.root !== root) throw new Error(`err: root`)
        if (node.workspace !== workspace) throw new Error(`err: workspace`)
      }
    }
  }
}

const versions = new Map<string, Version>()

export async function buildGraph(config: Config, source: Source) {
  const decoder = new TextDecoder()
  const tree = await source.getTree()
  const index = tree.index()
  const contents = source.getBlobs(
    [...index.values()].filter(sha => !versions.has(sha))
  )
  for await (const [sha, blob] of contents) {
    try {
      const text = decoder.decode(blob)
      const raw = JSON.parse(text)
      const {meta, data} = parseRecord(raw)
      const entryType = config.schema[meta.type]
      const searchableText = Type.searchableText(entryType, data)
      versions.set(sha, {
        id: meta.id,
        type: meta.type,
        index: meta.index,
        data,
        searchableText
      })
    } catch (error) {
      console.warn(`Failed to parse JSON: ${error}`)
    }
  }
  const entries = [...index].map(([file, sha]) => {
    const version = versions.get(sha)
    if (!version) throw new Error(`Missing version for sha: ${sha}`)
    return [file, version] as const
  })
  return new EntryGraph(config, entries)
}
