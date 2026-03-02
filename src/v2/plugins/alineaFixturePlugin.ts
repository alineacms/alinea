import fs from 'node:fs/promises'
import path from 'node:path'
import {FSSource} from '../../core/source/FSSource'
import type {Plugin} from 'vite'

const virtualSuffix = '?alinea-fixture'

interface AlineaFixturePluginOptions {
  query: string
}

interface ResolveIdOptions {
  attributes?: Record<string, string>
}

interface ExportedFixtureSource {
  tree: unknown
  blobs: Record<string, string>
}

function hasQueryFlag(source: string, query: string): boolean {
  const questionMark = source.indexOf('?')
  if (questionMark === -1) return false
  const search = source.slice(questionMark + 1)
  const params = new URLSearchParams(search)
  return params.has(query)
}

function stripQuery(source: string): string {
  const questionMark = source.indexOf('?')
  return questionMark === -1 ? source : source.slice(0, questionMark)
}

async function listFilesRecursive(dir: string): Promise<Array<string>> {
  const result: Array<string> = []
  const entries = await fs.readdir(dir, {withFileTypes: true}).catch(() => [])
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(entryPath)
      result.push(...nested)
      continue
    }
    if (entry.isFile()) result.push(entryPath)
  }
  return result
}

async function exportFixtureSource(
  cmsFile: string
): Promise<ExportedFixtureSource> {
  const contentDir = path.join(path.dirname(cmsFile), 'content')
  const source = new FSSource(contentDir)
  const tree = await source.getTree()
  const shas = Array.from(tree.index(), ([, sha]) => sha)
  const blobs: Record<string, string> = {}
  for await (const [sha, blob] of source.getBlobs(shas)) {
    blobs[sha] = Buffer.from(blob).toString('base64')
  }
  return {tree: tree.toJSON(), blobs}
}

export function alineaFixturePlugin(): Plugin {
  const options: AlineaFixturePluginOptions = {query: 'alinea'}

  return {
    name: 'alinea-fixture',
    enforce: 'pre',

    async resolveId(source, importer, resolveOptions?: ResolveIdOptions) {
      const queryImport = hasQueryFlag(source, options.query)
      const attributeImport = resolveOptions?.attributes?.type === 'alinea'
      if (!queryImport && !attributeImport) return null

      const request = stripQuery(source)
      const resolved = await this.resolve(request, importer, {skipSelf: true})
      if (!resolved) return null
      return `${resolved.id}${virtualSuffix}`
    },

    async load(id) {
      if (!id.endsWith(virtualSuffix)) return null
      const cmsFile = id.slice(0, -virtualSuffix.length)
      const contentDir = path.join(path.dirname(cmsFile), 'content')
      this.addWatchFile(cmsFile)
      const contentFiles = await listFilesRecursive(contentDir)
      for (const file of contentFiles) this.addWatchFile(file)

      const exportedSource = await exportFixtureSource(cmsFile)
      const serialized = JSON.stringify(exportedSource)
      const importPath = JSON.stringify(cmsFile)

      return `
import {LocalDB} from 'alinea/core/db/LocalDB'
import {MemorySource} from 'alinea/core/source/MemorySource'
import {ReadonlyTree} from 'alinea/core/source/Tree'
import {cms} from ${importPath}

const exportedSource = ${serialized}
function decodeBase64(input) {
  const binary = atob(input)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
const blobs = new Map(
  Object.entries(exportedSource.blobs).map(([sha, encoded]) => {
    return [sha, decodeBase64(encoded)]
  })
)
const source = new MemorySource(new ReadonlyTree(exportedSource.tree), blobs)
const db = new LocalDB(cms.config, source)
await db.sync()

export {cms, db}
`
    }
  }
}
