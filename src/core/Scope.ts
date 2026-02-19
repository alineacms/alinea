import type {Workspace} from 'alinea/types'
import type {Config} from './Config.js'
import {Expr} from './Expr.js'
import type {Field} from './Field.js'
import {getExpr, type HasRoot, type HasWorkspace, hasExpr} from './Internal.js'
import type {Page} from './Page.js'
import type {Root} from './Root.js'
import type {Type} from './Type.js'
import {entries} from './util/Objects.js'

export type Entity = Workspace | Root | Type | Field | Expr | Page

const scopes = new WeakMap()
const ENTITY_KEY = '@alinea.Entity'
const EXPR_KEY = '@alinea.Expr'

export const ScopeKey = {
  workspace(workspace: string) {
    return `Workspace.${workspace}`
  },
  root(workspace: string, root: string) {
    return `Root.${workspace}.${root}`
  },
  page(workspace: string, root: string, page: string) {
    return `Page.${workspace}.${root}.${page}`
  },
  type(type: string) {
    return `Type.${type}`
  },
  field(type: string, field: string) {
    return `Field.${type}.${field}`
  },
  entry(entryId: string) {
    return `Entry.${entryId}`
  },
  locale(locale: string | null) {
    return `Locale.${locale ?? 'null'}`
  }
}

export class Scope {
  #keys: Map<string, Entity> = new Map()
  #paths: Map<Entity, Array<string>> = new Map()

  constructor(config: Config) {
    for (const [workspaceName, workspace] of entries(config.workspaces)) {
      this.#insert(workspace, ScopeKey.workspace(workspaceName))
      for (const [rootName, root] of entries(workspace)) {
        this.#insert(root, ScopeKey.root(workspaceName, rootName))
        for (const [pageName, page] of entries(root)) {
          this.#insert(page, ScopeKey.page(workspaceName, rootName, pageName))
        }
      }
    }
    for (const [typeName, type] of entries(config.schema)) {
      this.#insert(type, ScopeKey.type(typeName))
      for (const [fieldName, field] of entries(type)) {
        this.#insert(field, ScopeKey.field(typeName, fieldName))
      }
    }
  }

  workspaceOf(root: HasRoot): HasWorkspace {
    const path = this.#paths.get(root)
    if (!path) throw new Error(`Root not found in scope: ${root}`)
    return this.#keys.get(path[0]) as Workspace
  }

  keyOf(entity: Entity) {
    const path = this.#paths.get(entity)
    if (!path) throw new Error(`Entity not found in scope: ${entity}`)
    return path.join('.')
  }

  locationOf(entity: Entity) {
    return this.#paths.get(entity)?.slice(1)
  }

  nameOf(entity: Entity) {
    return this.#paths.get(entity)?.at(-1)
  }

  stringify(input: any): string {
    const result = JSON.stringify(input, (key, value) => {
      if (this.#paths.has(value))
        return {[ENTITY_KEY]: this.#paths.get(value)?.join('.')}
      if (value && typeof value === 'object' && hasExpr(value))
        return {[EXPR_KEY]: getExpr(value)}
      return value
    })
    return result
  }

  parse<Result>(input: string): Result {
    const result = JSON.parse(input, (key, value) => {
      if (value && typeof value === 'object') {
        const props = Object.keys(value)
        if (props.length === 1) {
          const [key] = props
          if (key === ENTITY_KEY) return this.#keys.get(value[key])
          if (key === EXPR_KEY) return new Expr(value[key])
        }
      }
      return value
    })
    return result
  }

  #insert(entity: Entity, key: string) {
    const exists = this.#paths.get(entity)
    const segments = key.split('.')
    if (exists)
      throw new Error(
        `${segments[0]} '${segments.slice(1).join('.')}' is already in use at '${exists
          .slice(1)
          .join('.')}' — ${segments[0]}s must be unique`
      )
    this.#paths.set(entity, segments)
    this.#keys.set(key, entity)
  }
}

export function getScope(config: Config): Scope {
  if (!scopes.has(config)) {
    scopes.set(config, new Scope(config))
  }
  return scopes.get(config)
}
