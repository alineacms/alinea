import {Workspace} from 'alinea/types'
import {Config} from './Config.js'
import {Expr} from './Expr.js'
import {Field} from './Field.js'
import {getExpr, hasExpr} from './Internal.js'
import {PageSeed} from './Page.js'
import {Root} from './Root.js'
import {Type} from './Type.js'
import {entries} from './util/Objects.js'

const scopes = new WeakMap()
type Entity = Workspace | Root | Type | Field | Expr | PageSeed
const ENTITY_KEY = '@alinea.Entity'
const EXPR_KEY = '@alinea.Expr'

export class Scope {
  #keys: Map<string, Entity> = new Map()
  #paths: Map<Entity, Array<string>> = new Map()

  constructor(config: Config) {
    for (const [workspaceName, workspace] of entries(config.workspaces)) {
      this.#insert(workspace, 'workspace', workspaceName)
      for (const [rootName, root] of entries(workspace)) {
        this.#insert(root, 'root', workspaceName, rootName)
        for (const [pageName, page] of entries(root)) {
          this.#insert(page, 'page', workspaceName, rootName, pageName)
        }
      }
    }
    for (const [typeName, type] of entries(config.schema)) {
      this.#insert(type, 'type', typeName)
      for (const [fieldName, field] of entries(type)) {
        this.#insert(field, 'field', typeName, fieldName)
      }
    }
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
          else if (key === EXPR_KEY) return new Expr(value[key])
        }
      }
      return value
    })
    return result
  }

  #insert(entity: Entity, ...path: Array<string>) {
    const key = path.join('.')
    this.#keys.set(key, entity)
    this.#paths.set(entity, path)
  }
}

export function getScope(config: Config): Scope {
  if (!scopes.has(config)) {
    scopes.set(config, new Scope(config))
  }
  return scopes.get(config)
}
