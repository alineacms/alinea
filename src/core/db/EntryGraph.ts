import type {EntryStatus} from 'alinea/core.js'
import {Config} from '../Config.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import type {Source} from '../source/Source.js'
import {compareStrings} from '../source/Utils.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo} from '../util/EntryFilenames.js'
import {keys} from '../util/Objects.js'

interface EntryVersionData {
  id: string
  type: string
  index: string
  searchableText: string
  data: object
}

interface EntryVersion {
  locale: string | null
  workspace: string
  root: string
  path: string
  status: EntryStatus
  data: EntryVersionData
  parentId: string | null
  parentDir: string
  childrenDir: string
}

class EntryLanguage extends Map<EntryStatus, EntryVersion> {
  readonly language: string | null
  readonly parentDir: string
  readonly selfDir: string
  constructor(versions: Array<EntryVersion>) {
    super(versions.map(phase => [phase.status, phase] as const))
    this.language = versions[0].locale
    this.parentDir = versions[0].parentDir
    this.selfDir = versions[0].childrenDir
  }
}

class EntryNode extends Map<string | null, EntryLanguage> {
  readonly id: string
  readonly type: string
  readonly index: string
  readonly workspace: string
  readonly root: string
  readonly parentId: string | null
  constructor(languages: Array<EntryVersion>) {
    super()
    const [first, ...rest] = languages
    this.id = first.data.id
    this.type = first.data.type
    this.index = first.data.index
    this.workspace = first.workspace
    this.root = first.root
    this.parentId = first.parentId
    for (const language of rest) {
      if (language.data.type !== this.type) throw new Error(`err: type`)
      if (language.data.index !== this.index) throw new Error(`err: index`)
      if (language.root !== this.root) throw new Error(`err: root`)
      if (language.workspace !== this.workspace)
        throw new Error(`err: workspace`)
      if (language.parentId !== this.parentId) throw new Error(`err: parentId`)
    }
    const byLanguage = new Map<string | null, Array<EntryVersion>>()
    for (const language of languages) {
      const collection = byLanguage.get(language.locale) ?? []
      collection.push(language)
      byLanguage.set(language.locale, collection)
    }
    for (const [locale, versions] of byLanguage) {
      this.set(locale, new EntryLanguage(versions))
    }
  }
}

class EntryGraph {
  nodes: Array<EntryNode>
  #byId = new Map<string, EntryNode>()
  #byDir = new Map<string, string>()
  constructor(config: Config, versionData: Map<string, EntryVersionData>) {
    const singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
    const filesById = new Map<string, Array<string>>()
    for (const [file, version] of versionData) {
      const files = filesById.get(version.id) ?? []
      files.push(file)
      filesById.set(version.id, files)
      const dir = getNodePath(file)
      this.#byDir.set(dir, version.id)
    }
    const mkVersion = (file: string): EntryVersion => {
      const data = versionData.get(file)!
      const segments = file.toLowerCase().split('/')
      const baseName = segments.at(-1)
      assert(baseName)
      const lastDot = baseName.lastIndexOf('.')
      assert(lastDot !== -1)
      const fileName = baseName.slice(0, lastDot)
      const [path, status] = entryInfo(fileName)
      const parentDir = segments.slice(0, -1).join('/')
      const parentId = this.#byDir.get(parentDir) ?? null
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
        data,
        parentId,
        parentDir,
        childrenDir
      }
    }
    const mkNode = (id: string): EntryNode => {
      if (this.#byId.has(id)) return this.#byId.get(id)!
      const files = filesById.get(id)!
      const node = new EntryNode(files.map(mkVersion))
      this.#byId.set(id, node)
      return node
    }
    this.nodes = [...filesById.keys()]
      .map(mkNode)
      .sort((a, b) => compareStrings(a.index, b.index))
  }
}

const dataCache = new Map<string, EntryVersionData>()

export async function buildGraph(config: Config, source: Source) {
  const decoder = new TextDecoder()
  const tree = await source.getTree()
  const index = tree.index()
  const contents = source.getBlobs(
    [...index.values()].filter(sha => !dataCache.has(sha))
  )
  for await (const [sha, blob] of contents) {
    try {
      const text = decoder.decode(blob)
      const raw = JSON.parse(text)
      const {meta, data} = parseRecord(raw)
      const entryType = config.schema[meta.type]
      const searchableText = Type.searchableText(entryType, data)
      dataCache.set(sha, {
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
    const version = dataCache.get(sha)
    if (!version) throw new Error(`Missing version for sha: ${sha}`)
    return [file, version] as const
  })
  return new EntryGraph(config, new Map(entries))
}

function getNodePath(filePath: string) {
  const lastSlash = filePath.lastIndexOf('/')
  const dir = filePath.slice(0, lastSlash)
  const name = filePath.slice(lastSlash + 1)
  const lastDot = name.lastIndexOf('.')
  let base = lastDot === -1 ? name : name.slice(0, lastDot)
  if (base.endsWith('.archived')) base = base.slice(0, -'.archived'.length)
  if (base.endsWith('.draft')) base = base.slice(0, -'.draft'.length)
  return `${dir}/${base}`
}
