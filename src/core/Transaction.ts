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
    this.commited = true
    const mutations = await Promise.all(this.tasks.map(task => task(this.cms)))
    const cnx = await this.cms.connection()
    const result = await cnx.mutate(mutations.flat())
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
  constructor(tx: Transaction, protected entryId: string) {
    super(
      tx.addTask(async ({config, graph}) => {
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
    )
  }
}

export class EditOp<Definition> extends Op {
  entryData?: Partial<Type.Infer<Definition>>
  changePhase?: EntryPhase

  constructor(
    tx: Transaction,
    protected entryId: string,
    protected phase = EntryPhase.Published
  ) {
    super(
      tx.addTask(async ({graph, config}) => {
        const entry = await graph.all.get(
          Entry({entryId: this.entryId, phase: this.phase})
        )
        const parentPaths = entryParentPaths(config, entry)
        const file = entryFileName(config, entry, parentPaths)
        const mutations: Array<Mutation> = []
        if (this.entryData)
          mutations.push({
            type: MutationType.Patch,
            entryId: this.entryId,
            file,
            patch: this.entryData
          })
        switch (this.changePhase) {
          case EntryPhase.Published:
            mutations.push({
              type: MutationType.Publish,
              phase: this.phase,
              entryId: this.entryId,
              file
            })
            break
          case EntryPhase.Archived:
            mutations.push({
              type: MutationType.Archive,
              entryId: this.entryId,
              file
            })
            break
        }
        return mutations
      })
    )
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

  /*createAfter<Definition>(type: Type<Definition>) {
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
  }*/

  archive() {
    this.phase = EntryPhase.Published
    this.changePhase = EntryPhase.Archived
    return this
  }

  publish() {
    this.phase = EntryPhase.Draft
    this.changePhase = EntryPhase.Published
    return this
  }
}

export class CreateOp<Definition> extends Op {
  parentId?: string
  entryData: Partial<Type.Infer<Definition>> = {}

  constructor(
    tx: Transaction,
    protected type: Type<Definition>,
    public entryId: string = createId()
  ) {
    super(
      tx.addTask(async ({config, graph}) => {
        const parent = this.parentId
          ? await graph.preferPublished.get(Entry({entryId: this.parentId}))
          : undefined
        const entry = await createEntry(
          config,
          this.type,
          this.entryData,
          parent
        )
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
    )
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
