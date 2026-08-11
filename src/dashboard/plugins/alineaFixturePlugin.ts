import fs from 'node:fs/promises'
import path from 'node:path'
import type {Plugin} from 'vite'
import type {Revision} from '../../core/Connection.js'
import type {EntryRecord} from '../../core/EntryRecord.js'
import {FSSource} from '../../core/source/FSSource.js'
import {exportSource} from '../../core/source/SourceExport.js'

const virtualSuffix = '?alinea-fixture'

interface AlineaFixturePluginOptions {
  query: string
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

interface FixtureHistory {
  revisions: Array<Revision>
  records: Record<string, EntryRecord>
}

function createHistoryRecord(
  record: EntryRecord,
  label: string,
  index: number
): EntryRecord {
  const title = typeof record.title === 'string' ? record.title : 'Untitled'
  const summary =
    typeof record.summary === 'string' ? record.summary : undefined
  return {
    ...record,
    title: `${title} (${label})`,
    ...(summary
      ? {summary: `${summary} This is fixture history revision ${index}.`}
      : {})
  }
}

async function createFixtureHistory(source: FSSource) {
  const tree = await source.getTree()
  const index = tree.index()
  const decoder = new TextDecoder()
  const history: Record<string, FixtureHistory> = {}
  const now = Date.now()
  const jsonFiles = Array.from(index.keys()).filter(file =>
    file.endsWith('.json')
  )
  const blobs = new Map<string, Uint8Array>()
  for await (const blob of source.getBlobs([...index.values()])) {
    blobs.set(blob[0], blob[1])
  }
  for (const file of jsonFiles) {
    const sha = index.get(file)
    if (!sha) continue
    const blob = blobs.get(sha)
    if (!blob) continue
    const record = JSON.parse(decoder.decode(blob)) as EntryRecord
    const currentRef = `${sha}:current`
    const yesterdayRef = `${sha}:yesterday`
    const previousRef = `${sha}:previous`
    const fileKey = `content/${file}`
    history[fileKey] = {
      revisions: [
        {
          ref: currentRef,
          createdAt: now,
          file: fileKey,
          user: {name: 'Stijn Codeurs', email: 'stijn@example.com'},
          description: 'Page published'
        },
        {
          ref: yesterdayRef,
          createdAt: now - 24 * 60 * 60 * 1000,
          file: fileKey,
          user: {name: 'Stijn Codeurs', email: 'stijn@example.com'},
          description: 'Page unpublished'
        },
        {
          ref: previousRef,
          createdAt: now - 2 * 24 * 60 * 60 * 1000,
          file: fileKey,
          user: {name: 'Stijn Codeurs', email: 'stijn@example.com'},
          description: 'Draft'
        }
      ],
      records: {
        [currentRef]: record,
        [yesterdayRef]: createHistoryRecord(record, 'yesterday', 1),
        [previousRef]: createHistoryRecord(record, 'previous', 2)
      }
    }
  }
  return history
}

export function alineaFixturePlugin(): Plugin {
  const options: AlineaFixturePluginOptions = {query: 'alinea'}

  return {
    name: 'alinea-fixture',
    enforce: 'pre',

    async resolveId(source, importer) {
      const queryImport = hasQueryFlag(source, options.query)
      if (!queryImport) return null

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
      const source = new FSSource(contentDir)
      const exportedSource = await exportSource(source)
      const history = await createFixtureHistory(source)
      const serialized = JSON.stringify(exportedSource)
      const serializedHistory = JSON.stringify(history)
      const importPath = JSON.stringify(cmsFile)

      return `
import {LocalDB} from '#/core/db/LocalDB.js'
import {importSource} from '#/core/source/SourceExport.js'
import {cms} from ${importPath}

const exportedSource = ${serialized}
const fixtureHistory = ${serializedHistory}
const source = await importSource(exportedSource)
const fixtureUser = {
  sub: 'fixture-user',
  name: 'Stijn Codeurs',
  email: 'stijn@example.com',
  roles: ['admin']
}

class FixtureDB extends LocalDB {
  capabilities() {
    return Promise.resolve({users: true})
  }

  previewToken() {
    return Promise.resolve('dev-preview-token')
  }

  user() {
    return Promise.resolve(fixtureUser)
  }

  enrichUser(user) {
    return Promise.resolve(user)
  }

  listUsers() {
    return Promise.resolve([fixtureUser])
  }

  createUser(user) {
    return Promise.resolve({...user, sub: user.sub ?? user.email ?? 'user'})
  }

  updateUser(user) {
    return Promise.resolve({...user, sub: user.sub ?? user.email ?? 'user'})
  }

  removeUser() {
    return Promise.resolve()
  }

  revisions(file) {
    return Promise.resolve(fixtureHistory[file]?.revisions ?? [])
  }

  revisionData(file, revisionId) {
    return Promise.resolve(fixtureHistory[file]?.records[revisionId])
  }

  getDraft() {
    return Promise.resolve(undefined)
  }

  storeDraft() {
    return Promise.resolve()
  }
}

const db = new FixtureDB(cms.config, source)
await db.sync()

export {cms, db}
`
    }
  }
}
