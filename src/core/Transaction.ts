import {CMS} from './CMS.js'
import {Config} from './Config.js'
import {Entry} from './Entry.js'
import {
  entryChildrenDir,
  entryFileName,
  entryFilepath
} from './EntryFilenames.js'
import {EntryPhase, EntryRow} from './EntryRow.js'
import {createId} from './Id.js'
import {Mutation, MutationType} from './Mutation.js'
import {Schema} from './Schema.js'
import {Type, TypeI} from './Type.js'
import {createEntryRow, entryParentPaths} from './util/EntryRows.js'
import {slugify} from './util/Slugs.js'

export class Transaction {
  commited = false
  constructor(
    protected cms: CMS,
    protected tasks: Array<(cms: CMS) => Promise<Array<Mutation>>> = []
  ) {}

  addTask(task: (cms: CMS) => Promise<Array<Mutation>>) {
    this.tasks.push(task)
    return this
  }

  async commit() {
    if (this.commited) throw new Error(`Transaction already commited`)
    const mutations = await Promise.all(this.tasks.map(task => task(this.cms)))
    const cnx = await this.cms.connection()
    const result = await cnx.mutate(mutations.flat())
    this.commited = true
    return result
  }
}

export class Op {
  constructor(protected tx: Transaction) {}

  create<Definition>(type: Type<Definition>) {
    return new CreateOp<Definition>(this.tx, type)
  }

  edit<Definition>(entryId: string, type?: Type<Definition>) {
    return new EditOp<Definition>(this.tx, entryId)
  }

  delete(entryId: string) {
    return new DeleteOp(this.tx, entryId)
  }

  async commit() {
    await this.tx.commit()
  }
}

export class DeleteOp extends Op {
  constructor(protected tx: Transaction, protected entryId: string) {
    super(tx)
    this.tx.addTask(async ({config, graph}) => {
      const entry = await graph.preferPublished.get(
        Entry({entryId: this.entryId})
      )
      const parentPaths = entryParentPaths(config, entry)
      const file = entryFileName(config, entry, parentPaths)
      return [
        {
          type: MutationType.Remove,
          entryId: this.entryId,
          file
        }
      ]
    })
  }
}

export class EditOp<Definition> extends Op {
  entryData: Partial<Type.Infer<Definition>> = {}

  constructor(protected tx: Transaction, protected entryId: string) {
    super(tx)
    this.tx.addTask(async ({graph, config}) => {
      const entry = await graph.preferPublished.get(
        Entry({entryId: this.entryId})
      )
      const parentPaths = entryParentPaths(config, entry)
      const file = entryFileName(config, entry, parentPaths)
      return [
        {
          type: MutationType.Patch,
          entryId: this.entryId,
          file,
          patch: this.entryData
        }
      ]
    })
  }

  set(entryData: Partial<Type.Infer<Definition>>) {
    this.entryData = {...this.entryData, ...entryData}
    return this
  }

  moveTo(workspace: string, root: string, parentId?: string) {
    throw new Error(`Not implemented`)
    return this
  }

  setParent(parentId: string) {
    throw new Error(`Not implemented`)
    return this
  }

  createAfter<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(this.tx, type)
  }

  createBefore<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(this.tx, type)
  }

  createChild<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(this.tx, type)
  }

  archive() {
    throw new Error(`Not implemented`)
    return this
  }

  saveDraft() {
    return this
  }

  publish() {
    throw new Error(`Not implemented`)
    return this
  }
}

export class CreateOp<Definition> extends Op {
  parentId?: string
  entryData: Partial<Type.Infer<Definition>> = {}

  constructor(
    protected tx: Transaction,
    protected type: Type<Definition>,
    public entryId: string = createId()
  ) {
    super(tx)
    this.tx.addTask(async ({config}) => {
      const entry = await createEntry(config, this.type, this.entryData)
      const parentPaths = entryParentPaths(config, entry)
      const file = entryFileName(config, entry, parentPaths)
      return [
        {
          type: MutationType.Create,
          entryId: this.entryId,
          file,
          entry: entry
        }
      ]
    })
  }

  setParent(parentId: string) {
    this.parentId = parentId
    return this
  }

  set(entryData: Partial<Type.Infer<Definition>>) {
    this.entryData = {...this.entryData, ...entryData}
    return this
  }

  createChild<Definition>(type: Type<Definition>) {
    return new CreateOp(this.tx, type).setParent(this.entryId)
  }

  async publish(): Promise<string> {
    await this.tx.commit()
    return this.entryId
  }
}

async function createEntry(
  config: Config,
  type: TypeI,
  data: Partial<EntryRow> = {title: 'Entry'},
  parent?: EntryRow
): Promise<EntryRow> {
  const typeNames = Schema.typeNames(config.schema)
  const title = data.title ?? 'Entry'
  const details = {
    entryId: createId(),
    phase: EntryPhase.Published,
    type: typeNames.get(type)!,
    title,
    path: data.path ?? slugify(title),
    seeded: null,
    workspace: 'main',
    root: 'pages',
    level: 0,
    parent: parent?.entryId ?? null,
    locale: null,
    index: 'a0',
    i18nId: createId(),
    modifiedAt: 0,
    active: true,
    main: true,
    data: data.data ?? {},
    searchableText: ''
  }
  const parentPaths = parent?.childrenDir.split('/').filter(Boolean) ?? []
  const filePath = entryFilepath(config, details, parentPaths)
  const childrenDir = entryChildrenDir(config, details, parentPaths)
  const row = {
    ...details,
    filePath,
    childrenDir,
    parentDir: childrenDir.split('/').slice(0, -1).join('/'),
    url: childrenDir
  }
  return createEntryRow(config, row)
}
