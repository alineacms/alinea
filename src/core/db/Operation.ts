import type {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import type {Graph} from '../Graph.js'
import {createId} from '../Id.js'
import type {StoredRow} from '../Infer.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import {keys} from '../util/Objects.js'
import type {Mutation} from './Mutation.js'

type Awaitable<T> = T | Promise<T>
type Task = (graph: Graph) => Awaitable<Array<Mutation>>

export class Operation {
  constructor(public task: Task) {}
}

export interface CreateQuery<Fields> {
  type: Type<Fields>
  id?: string
  workspace?: string
  root?: string
  parentId?: string | null
  locale?: string
  status?: 'draft' | 'published' | 'archived'
  set: Partial<StoredRow<Fields>>
  insertOrder?: 'first' | 'last'
}

function typeName(config: Config, type: Type) {
  const typeNames = Schema.typeNames(config.schema)
  const typeName = typeNames.get(type)!
  if (!typeName)
    throw new Error(`Type "${Type.label(type)}" not found in Schema`)
  return typeName
}

export class CreateOperation<Fields> extends Operation {
  id: string
  constructor(op: CreateQuery<Fields>) {
    super((graph): Array<Mutation> => {
      const workspaces = keys(graph.config.workspaces)
      const workspace = op.workspace ?? workspaces[0]
      const roots = keys(graph.config.workspaces[workspace])
      const root = op.root ?? roots[0]
      return [
        {
          op: 'create',
          id: this.id,
          locale: op.locale ?? null,
          parentId: op.parentId ?? null,
          type: typeName(graph.config, op.type),
          root,
          workspace,
          data: op.set ?? {},
          insertOrder: op.insertOrder,
          status: op.status
        }
      ]
    })
    this.id = op.id ?? createId()
  }
}

export class DeleteOp extends Operation {
  constructor(protected entryIds: Array<string>) {
    super((): Array<Mutation> => {
      return entryIds.map(id => {
        return {
          op: 'remove',
          id
        }
      })
    })
  }
}

export interface UpdateQuery<Fields> {
  type?: Type<Fields>
  id: string
  set: Partial<StoredRow<Fields>>
  status?: 'draft' | 'published' | 'archived'
  locale?: string | null
}

export class UpdateOperation<Definition> extends Operation {
  constructor(query: UpdateQuery<Definition>) {
    super((): Array<Mutation> => {
      const {status = 'published', locale = null, id, set} = query
      return [
        {
          op: 'update',
          id,
          locale,
          status: status as EntryStatus,
          set
        }
      ]
    })
  }
}

export interface MoveQuery {
  id: string
  after: string | null
  toParent?: string
  toRoot?: string
}

export class MoveOperation extends Operation {
  constructor(query: MoveQuery) {
    super((): Array<Mutation> => {
      return [{op: 'move', ...query}]
    })
  }
}

export interface PublishQuery {
  id: string
  status: 'draft' | 'archived'
  locale?: string | null
}

export class PublishOperation extends Operation {
  constructor(query: PublishQuery) {
    super((): Array<Mutation> => {
      return [{op: 'publish', ...query, locale: query.locale ?? null}]
    })
  }
}

export interface ArchiveQuery {
  id: string
  locale?: string | null
}

export class ArchiveOperation extends Operation {
  constructor(query: ArchiveQuery) {
    super((): Array<Mutation> => {
      return [{op: 'archive', ...query, locale: query.locale ?? null}]
    })
  }
}
