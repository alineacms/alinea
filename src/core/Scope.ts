import type {Workspace} from '#/types.js'
import type {Config} from './Config.js'
import {Expr} from './Expr.js'
import type {Field} from './Field.js'
import {
  getExpr,
  getReplaced,
  getRoot,
  getType,
  type HasRoot,
  type HasWorkspace,
  hasExpr,
  hasType
} from './Internal.js'
import type {Page} from './Page.js'
import type {Root} from './Root.js'
import type {Type} from './Type.js'
import {entries, values} from './util/Objects.js'

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
  #locales: Map<string, Array<string>> = new Map()
  #nested: Map<Entity, Array<string>> = new Map()
  #nestedKeys: Map<string, Entity> = new Map()
  #shared: Set<Entity> = new Set()
  #adopted: WeakMap<object, Entity> = new WeakMap()

  constructor(config: Config) {
    for (const [workspaceName, workspace] of entries(config.workspaces)) {
      this.#insert(workspace, ScopeKey.workspace(workspaceName))
      for (const [rootName, root] of entries(workspace)) {
        this.#insert(root, ScopeKey.root(workspaceName, rootName))
        for (const locale of getRoot(root).i18n?.locales ?? []) {
          const key = locale.toLowerCase()
          const spellings = this.#locales.get(key) ?? []
          if (!spellings.includes(locale)) spellings.push(locale)
          this.#locales.set(key, spellings)
        }
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
    for (const [typeName, type] of entries(config.schema))
      for (const [fieldName, field] of entries(type))
        this.#insertNested(field, ['Field', typeName, fieldName])
    // Queries naming a built-in type find the type standing in for it
    for (const type of values(config.schema)) {
      const replaced = getReplaced(type)
      if (replaced) this.#adopted.set(replaced, type)
    }
    for (const [field, path] of this.#nested)
      this.#nestedKeys.set(path.join('.'), field)
  }

  // Fields of object fields get a key, eg. Field.Type.object.field, so roles
  // can target them and queries can select them. They are kept apart from the
  // other entities, which have a name. A field instance used in more than one
  // place has no single key, so it can't be targeted.
  #insertNested(field: Field, path: Array<string>) {
    if (!hasType(field)) return
    for (const [name, inner] of entries(getType(field).allFields)) {
      const location = [...path, name]
      if (this.#nested.has(inner)) {
        this.#nested.delete(inner)
        this.#shared.add(inner)
      } else if (!this.#paths.has(inner) && !this.#shared.has(inner)) {
        this.#nested.set(inner, location)
      }
      this.#insertNested(inner, location)
    }
  }

  workspaceOf(root: HasRoot): HasWorkspace {
    const path = this.#paths.get(this.#current(root))
    if (!path) throw new Error(`Root not found in scope: ${root}`)
    return this.#keys.get(path[0]) as Workspace
  }

  keyOf(entity: Entity) {
    entity = this.#current(entity)
    if (this.#shared.has(entity))
      throw new Error(
        'Field is used in more than one place, target the field containing it'
      )
    const path = this.#paths.get(entity) ?? this.#nested.get(entity)
    if (!path) throw new Error(`Entity not found in scope: ${entity}`)
    return path.join('.')
  }

  /** The type of a field and its path in there, such as `seo.title` */
  fieldOf(field: Field): [type: string, path: string] | undefined {
    field = this.#current(field)
    const path = this.#paths.get(field) ?? this.#nested.get(field)
    if (path?.[0] !== 'Field') return
    return [path[1], path.slice(2).join('.')]
  }

  locationOf(entity: Entity) {
    return this.#paths.get(this.#current(entity))?.slice(1)
  }

  nameOf(entity: Entity) {
    return this.#paths.get(this.#current(entity))?.at(-1)
  }

  /**
   * Where a field stores its value in the entry data, eg. `['seo', 'title']`
   * for a field of an object field
   */
  dataPathOf(field: Field): Array<string> | undefined {
    field = this.#current(field)
    if (this.#shared.has(field))
      throw new Error(
        'Field is used in more than one place, select the field containing it'
      )
    const path = this.#paths.get(field) ?? this.#nested.get(field)
    if (path?.[0] !== 'Field') return
    return path.slice(2)
  }

  /** Configured spellings of a locale, matched case-insensitively. */
  locales(locale: string): Array<string> {
    return this.#locales.get(locale.toLowerCase()) ?? [locale]
  }

  stringify(input: any): string {
    const result = JSON.stringify(input, (key, raw) => {
      const value = this.#current(raw)
      const path = this.#paths.get(value) ?? this.#nested.get(value)
      if (path) return {[ENTITY_KEY]: path.join('.')}
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
          if (key === ENTITY_KEY)
            return (
              this.#keys.get(value[key]) ?? this.#nestedKeys.get(value[key])
            )
          if (key === EXPR_KEY) return new Expr(value[key])
        }
      }
      return value
    })
    return result
  }

  /**
   * Recognize the entities of a previous build of this config by their key.
   * The dev server replaces the config of its database when the schema
   * changes, while the handler of the previous config still answers queries
   * that name its own types and fields.
   */
  adopt(previous: Scope) {
    for (const [key, entity] of [...previous.#keys, ...previous.#nestedKeys]) {
      const current = this.#keys.get(key) ?? this.#nestedKeys.get(key)
      if (current && current !== entity) this.#adopted.set(entity, current)
    }
  }

  /** The entity of this config for an entity of an adopted build */
  #current<T>(entity: T): T {
    if (!entity || typeof entity !== 'object') return entity
    return (this.#adopted.get(entity) as T | undefined) ?? entity
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
