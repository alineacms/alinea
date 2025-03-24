import type {Change} from './Change.ts'
import type {Source} from './Source.ts'
import {ReadonlyTree} from './Tree.ts'
import {assert} from './Utils.ts'

export interface Entry<Document> {
  sha: string
  file: string
  document: Document
}

export interface ParseRequest<Document> {
  sha: string
  file: string
  parents: Array<Entry<Document>>
  contents: Uint8Array
}

export class Index<Document> {
  #tree = ReadonlyTree.EMPTY
  #source: Source
  #nodes = Array<Entry<Document>>()
  #parseDocument: (request: ParseRequest<Document>) => Document

  constructor(
    source: Source,
    parseDocument: (request: ParseRequest<Document>) => Document
  ) {
    this.#source = source
    this.#parseDocument = parseDocument
  }

  first(filter: (node: Document) => boolean): Document | undefined {
    const [doc] = this.find(filter)
    return doc
  }

  *find(filter: (node: Document) => boolean): Iterable<Document> {
    for (const {document} of this.#nodes) if (filter(document)) yield document
  }

  async sync() {
    const tree = await this.#source.getTree()
    const changes = await this.#source.bundleContents(this.#tree.diff(tree))
    if (changes.length === 0) return
    this.#applyChanges(changes)
    this.#tree = tree
  }

  async syncWith(remote: Source) {
    await this.#source.syncWith(remote)
    await this.sync()
  }

  #applyChanges(changes: Array<Change>) {
    const entries = new Map(this.#nodes.map(entry => [entry.file, entry]))
    for (const change of changes) {
      switch (change.op) {
        case 'delete': {
          const entry = entries.get(change.path)
          assert(entry, `Entry not found: ${change.path}`)
          assert(entry.sha === change.sha, `SHA mismatch: ${change.sha}`)
          entries.delete(change.path)
          continue
        }
        case 'add': {
          const contents = change.contents
          assert(contents, 'Missing contents')
          const extension = change.path.split('.').pop()
          const segments = change.path.split('/').slice(0, -1)
          const parents = Array<Entry<Document>>()
          for (let i = 1; i <= segments.length; i++) {
            const path = segments.slice(0, i).join('/')
            const parent = entries.get(`${path}.${extension}`)
            if (parent) parents.push(parent)
          }
          const document = this.#parseDocument({
            sha: change.sha,
            file: change.path,
            parents,
            contents
          })
          const entry = {sha: change.sha, file: change.path, document}
          entries.set(change.path, entry)
          continue
        }
      }
    }
    this.#nodes = [...entries.values()]
  }
}
