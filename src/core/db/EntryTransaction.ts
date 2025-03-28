import type {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import {createRecord} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {getRoot} from 'alinea/core/Internal'
import {Type} from 'alinea/core/Type'
import {pathSuffix} from 'alinea/core/util/EntryFilenames'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {unreachable} from 'alinea/core/util/Types'
import {SourceTransaction} from '../source/Source.js'
import type {Source} from '../source/Source.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {assert, compareStrings} from '../source/Utils.js'
import {type CommitChange, commitChanges} from './CommitRequest.js'
import type {EntryIndex} from './EntryIndex.js'
import type {
  ArchiveMutation,
  CreateMutation,
  MoveMutation,
  Mutation,
  PublishMutation,
  RemoveFileMutation,
  RemoveMutation,
  UpdateMutation,
  UploadFileMutation
} from './Mutation.js'

type Op<T> = Omit<T, 'op'>

export class EntryTransaction {
  #checks = Array<[path: string, sha: string]>()
  #messages = Array<string>()
  #config: Config
  #index: EntryIndex
  #tx: SourceTransaction
  #fileChanges = Array<CommitChange>()

  constructor(
    config: Config,
    index: EntryIndex,
    source: Source,
    from: ReadonlyTree
  ) {
    if (index.sha !== from.sha) throw new ShaMismatchError(index.sha, from.sha)
    this.#config = config
    this.#index = index
    this.#tx = new SourceTransaction(source, from)
  }

  create({
    locale,
    type,
    data,
    root,
    workspace,
    parentId = null,
    id = createId(),
    insertOrder = 'last',
    status = 'published'
  }: Op<CreateMutation>) {
    const index = this.#index
    const rootConfig = this.#config.workspaces[workspace][root]
    assert(rootConfig, 'Invalid root')
    const i18n = getRoot(rootConfig).i18n
    if (i18n) assert(i18n.locales.includes(locale as string), 'Invalid locale')
    let parent: Entry | undefined
    if (parentId) {
      parent = index.findFirst(entry => {
        return entry.id === parentId && entry.locale === locale && entry.main
      })
      assert(parent, `Parent not found: ${parentId}`)
      this.#checks.push([parent.filePath, parent.fileHash])
    }
    const siblings = Array.from(
      index.findMany(entry => {
        return (
          entry.root === root &&
          entry.workspace === workspace &&
          entry.parentId === parentId
        )
      })
    )
    assert(typeof data === 'object', 'Invalid data')
    const title = data.title
    assert(typeof title === 'string', 'Missing title')
    let path = slugify(typeof data.path === 'string' ? data.path : title)
    assert(path.length > 0, 'Invalid path')
    // Check if this path is in use within the same parent
    const conflictingPaths = siblings
      .filter(entry => {
        return (
          entry.locale === locale &&
          (entry.path === path || entry.path.startsWith(`${path}-`))
        )
      })
      .map(entry => entry.path)
    const suffix = pathSuffix(path, conflictingPaths)
    if (suffix !== undefined) path = `${path}-${suffix}`
    const parentDir = parent
      ? parent.childrenDir
      : locale !== null
        ? `${root}/${locale.toLowerCase()}`
        : root
    const filePath = paths.join(
      parentDir,
      `${path}${status === 'published' ? '' : `.${status}`}.json`
    )
    const existing = index.byId.get(id)
    const hasSameVersion = existing?.locales
      .get(locale)
      ?.has(status as EntryStatus)
    assert(!hasSameVersion, 'Cannot create duplicate entry')
    let newIndex: string
    if (existing) {
      newIndex = existing.index
    } else {
      const previous =
        insertOrder === 'first' ? null : (siblings.at(-1) ?? null)
      const next = insertOrder === 'last' ? null : (siblings.at(0) ?? null)
      newIndex = generateKeyBetween(
        previous?.index ?? null,
        next?.index ?? null
      )
    }
    if (locale !== null && status === 'published') {
      // Start from other locales if found
      const from = index.findFirst(entry => {
        return (
          entry.id === id &&
          entry.locale !== locale &&
          entry.status === 'published'
        )
      })
      if (from) {
        const typeInstance = this.#config.schema[type]
        assert(typeInstance, `Type not found: ${type}`)
        const shared = Type.sharedData(typeInstance, from.data)
        data = {...shared, ...data}
      }
      this.#persistSharedFields(id, locale, type, data)
    }
    const record = createRecord({id, type, index: newIndex, data})
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(filePath, contents)
    this.#messages.push(this.#reportOp('create', title))
    return this
  }

  update({id, locale, status, set}: Op<UpdateMutation>) {
    const index = this.#index
    const entry = index.findFirst(entry => {
      return (
        entry.id === id && entry.locale === locale && entry.status === status
      )
    })
    assert(entry, `Entry not found: ${id}`)
    const fieldUpdates = fromEntries(
      entries(set).map(([key, value]) => {
        return [key, value ?? null]
      })
    )
    const data = {...entry.data, ...fieldUpdates}
    if (locale !== null && status === 'published') {
      this.#persistSharedFields(id, locale, entry.type, data)
    }
    const record = createRecord({
      id,
      type: entry.type,
      index: entry.index,
      data
    })
    const path = slugify((data.path as string) ?? entry.data.path ?? entry.path)
    this.#checks.push([entry.filePath, entry.fileHash])
    const childrenDir = paths.join(entry.parentDir, path)
    const filePath = `${childrenDir}.json`
    if (entry.status === 'published') {
      if (filePath !== entry.filePath) {
        // Rename children and other statuses
        const versions = index.findMany(entry => {
          return (
            entry.id === id &&
            entry.locale === locale &&
            entry.status !== 'published'
          )
        })
        for (const version of versions)
          this.#tx.rename(
            version.filePath,
            paths.join(entry.parentDir, `${path}.${version.status}.json`)
          )
        this.#tx.remove(entry.filePath)
        this.#tx.rename(entry.childrenDir, childrenDir)
      }
    } else {
      if (path !== entry.path) record.path = path
    }
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(filePath, contents)
    this.#messages.push(this.#reportOp('update', entry.title))
    return this
  }

  #persistSharedFields(
    id: string,
    locale: string,
    type: string,
    data: Record<string, unknown>
  ) {
    const index = this.#index
    const typeInstance = this.#config.schema[type]
    assert(type, `Type not found: ${type}`)
    const shared = Type.sharedData(typeInstance, data)
    if (shared) {
      const translations = index.findMany(entry => {
        return (
          entry.id === id &&
          (entry.locale !== locale || entry.status !== 'published')
        )
      })
      for (const translation of translations) {
        this.#checks.push([translation.filePath, translation.fileHash])
        const record = createRecord({
          id,
          type: translation.type,
          index: translation.index,
          data: {
            ...translation.data,
            ...shared
          }
        })
        const contents = new TextEncoder().encode(
          JSON.stringify(record, null, 2)
        )
        this.#tx.add(translation.filePath, contents)
      }
    }
  }

  publish({id, locale, status}: Op<PublishMutation>) {
    const index = this.#index
    const entry = index.findFirst(entry => {
      return (
        entry.id === id && entry.locale === locale && entry.status === status
      )
    })
    assert(entry, `Entry not found: ${id}`)
    this.#checks.push([entry.filePath, entry.fileHash])
    this.#tx.rename(entry.filePath, `${entry.childrenDir}.json`)
    this.#messages.push(this.#reportOp('publish', entry.title))
    return this
  }

  archive({id, locale}: Op<ArchiveMutation>) {
    const index = this.#index
    const entry = index.findFirst(entry => {
      return (
        entry.id === id &&
        entry.locale === locale &&
        entry.status === 'published'
      )
    })
    assert(entry, `Entry not found: ${id}`)
    this.#checks.push([entry.filePath, entry.fileHash])
    this.#tx.rename(entry.filePath, `${entry.childrenDir}.${'archived'}.json`)
    this.#messages.push(this.#reportOp('archive', entry.title))
    return this
  }

  move({id, after, toParent, toRoot}: Op<MoveMutation>) {
    const index = this.#index
    const entries = Array.from(index.findMany(entry => entry.id === id))
    const previous = after ? index.findFirst(entry => entry.id === after) : null
    assert(entries.length > 0, `Entry not found: ${id}`)
    const parentId = toRoot ? null : (toParent ?? entries[0].parentId)
    const root = toRoot ?? entries[0].root
    const workspace = entries[0].workspace
    assert(
      previous === null || previous?.parentId === parentId,
      'Cannot move entry to a different parent'
    )
    let info: Entry | undefined
    for (const entry of entries) {
      info = entry
      const next = index.findFirst(entry => {
        const sameParent =
          entry.workspace === workspace &&
          entry.root === root &&
          entry.parentId === parentId
        return (
          sameParent && compareStrings(entry.index, previous?.index ?? '') > 0
        )
      })
      const newIndex = generateKeyBetween(
        previous?.index ?? null,
        next?.index ?? null
      )
      const parent = parentId
        ? index.findFirst(e => {
            return e.id === parentId && e.locale === entry.locale
          })
        : undefined

      if (toParent) {
        assert(parent, `Parent not found: ${parentId}`)
        // Check if the new parent is not a child of the entry
        assert(
          !parent?.childrenDir.startsWith(entry.childrenDir),
          'Cannot move entry into its own children'
        )
      }

      const parentDir = parent
        ? parent.childrenDir
        : entry.locale
          ? `$root/${entry.locale}`
          : root
      const childrenDir = paths.join(parentDir, entry.path)
      const filePath = `${childrenDir}${entry.status === 'published' ? '' : `.${entry.status}`}.json`
      const record = createRecord({
        id,
        type: entry.type,
        index: newIndex,
        data: entry.data
      })
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      this.#tx.add(filePath, contents)
      if (toParent || toRoot) {
        this.#tx.remove(entry.filePath)
        this.#tx.rename(entry.childrenDir, childrenDir)
      }
    }
    this.#messages.push(this.#reportOp('move', info!.title))
    return this
  }

  remove({id, locale, status}: Op<RemoveMutation>) {
    const index = this.#index
    const entries = index.findMany(entry => {
      const matchesStatus = status === undefined || entry.status === status
      const matchesLocale = locale === undefined || entry.locale === locale
      return entry.id === id && matchesLocale && matchesStatus
    })
    let info: Entry | undefined
    for (const entry of entries) {
      this.#checks.push([entry.filePath, entry.fileHash])
      this.#tx.remove(entry.filePath)
      this.#tx.remove(entry.childrenDir)
      info = entry
    }
    assert(info, `Entry not found: ${id}`)
    this.#messages.push(this.#reportOp('remove', info.title))
    return this
  }

  removeFile(mutation: Op<RemoveFileMutation>) {
    this.#messages.push(this.#reportOp('remove', mutation.location))
    this.#fileChanges.push({op: 'removeFile', ...mutation})
    return this
  }

  uploadFile(mutation: Op<UploadFileMutation>) {
    this.#fileChanges.push({op: 'uploadFile', ...mutation})
    return this
  }

  description() {
    return this.#messages
      .map((message: string, index: number, all: Array<string>) => {
        if (index > 0) return message
        const suffix =
          all.length > 1 ? ` (and ${all.length - 1} other edits)` : ''
        return `${message + suffix}`
      })
      .join('\n')
  }

  #reportOp(op: string, title: string) {
    return `(ɑ:${op}) ${title}`
  }

  apply(mutations: Array<Mutation>) {
    for (const mutation of mutations) {
      switch (mutation.op) {
        case 'create':
          this.create(mutation)
          break
        case 'update':
          this.update(mutation)
          break
        case 'publish':
          this.publish(mutation)
          break
        case 'archive':
          this.archive(mutation)
          break
        case 'move':
          this.move(mutation)
          break
        case 'remove':
          this.remove(mutation)
          break
        case 'removeFile':
          this.removeFile(mutation)
          break
        case 'uploadFile':
          this.uploadFile(mutation)
          break
        default:
          unreachable(mutation)
      }
    }
  }

  async toRequest() {
    const {from, into, changes} = await this.#tx.compile()
    return {
      fromSha: from.sha,
      intoSha: into.sha,
      description: this.description(),
      checks: this.#checks,
      changes: this.#fileChanges.concat(commitChanges(changes))
    }
  }
}

export class ShaMismatchError extends Error {
  status = 409
  constructor(
    public actual: string,
    public expected: string
  ) {
    super(`SHA mismatch: ${actual} != ${expected}`)
  }
}
