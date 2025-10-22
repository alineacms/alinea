import {Config} from '../Config.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import type {Source} from '../source/Source.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo} from '../util/EntryFilenames.js'
import {keys} from '../util/Objects.js'
import {Workspace} from '../Workspace.js'

interface EntryVersion {
  id: string
  type: string
  index: string
  searchableText: string
  data: object
}

interface EntryLanguage {
  locale: string | null
  workspace: string
  root: string
  path: string
  status: string
  version: EntryVersion
}

class EntryNode {
  id: string
  type: string
  index: string
  workspace: string
  root: string
  constructor(languages: Array<EntryLanguage>) {
    const [first, ...rest] = languages
    this.id = first.version.id
    this.type = first.version.type
    this.index = first.version.index
    this.workspace = first.workspace
    this.root = first.root
    for (const language of rest) {
      if (language.version.type !== this.type) throw new Error(`err: type`)
      if (language.version.index !== this.index) throw new Error(`err: index`)
      if (language.root !== this.root) throw new Error(`err: root`)
      if (language.workspace !== this.workspace)
        throw new Error(`err: workspace`)
    }
  }
}

class EntryGraph {
  #config: Config
  #nodes: Map<string, EntryNode> = new Map()
  constructor(config: Config, versions: Map<string, EntryVersion>) {
    this.#config = config
    const nodes = new Map<string, EntryNode>()
    const singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
    const filesById = new Map<string, Array<string>>()
    for (const [file, version] of versions) {
      const files = filesById.get(version.id) ?? []
      files.push(file)
      filesById.set(version.id, files)
    }
    const mkEntryLanguage = (file: string): EntryLanguage => {
      const version = versions.get(file)!
      const segments = file.toLowerCase().split('/')
      const baseName = segments.at(-1)
      assert(baseName)
      const lastDot = baseName.lastIndexOf('.')
      assert(lastDot !== -1)
      const fileName = baseName.slice(0, lastDot)
      const [path, status] = entryInfo(fileName)
      const parentDir = segments.slice(0, -1).join('/')
      const parent = mkNode(parentDir)
      const childrenDir = `${parentDir}/${path}`
      let segmentIndex = 0
      const workspace = singleWorkspace ?? segments[segmentIndex++]
      const workspaceConfig = config.workspaces[workspace]
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
      return {
        locale,
        workspace,
        root,
        path,
        status,
        version
      }
    }
    const mkNode = (id: string) => {
      if (nodes.has(id)) return nodes.get(id)!
      const files = filesById.get(id)!
      const node = new EntryNode(files.map(file => mkEntryLanguage(file)))
      nodes.set(id, node)
      return node

      /*let node: EntryNode
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
      return node*/
    }
    for (const [id] of filesById) {
      mkNode(id)
    }
  }
}

const versions = new Map<string, EntryVersion>()

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
  return new EntryGraph(config, new Map(entries))
}
