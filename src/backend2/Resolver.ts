import {Config} from 'alinea/core'
import {Store} from './Store.js'
import {EntryTree} from './collection/EntryTree.js'
import {CursorData} from './pages/Cursor.js'
import {
  Query as PageQuery,
  QueryData as PageQueryData,
  QueryData
} from './pages/Query.js'

const {entries, assign} = Object

class QueryResolver {
  tasks: Array<Promise<void>> = []

  constructor(
    protected store: Store,
    protected config: Config,
    protected query: QueryData
  ) {}

  select(row: any) {}

  async cursor(target: unknown, query: CursorData) {
    const targetName = query.target?.name
    const condition = targetName ? EntryTree.type.is(targetName) : true
    const entries = EntryTree(condition).take(query.take).skip(query.skip)
    const isSingle = query.first
    const type = targetName ? this.config.schema.type(targetName) : undefined
    if (targetName && !type) throw new Error(`Unknown type: ${targetName}`)
    if (isSingle) {
      const entry = await this.store(entries.first())
      assign(target as {}, entry)
    } else if (Array.isArray(target)) {
      for await (const entry of this.store.iterate(entries)) {
        // what are we actually selecting?
        target.push(entry)
      }
    }
  }

  resultType(query: PageQueryData) {
    switch (query.type) {
      case 'cursor':
        return query.cursor.first ? {} : []
      case 'record':
        return {}
      case 'expr':
        switch (query.expr.type) {
          case 'value':
            return query.expr.value
          default:
            throw new Error('Invalid query')
        }
    }
  }

  enqueue(target: unknown, query: QueryData) {
    switch (query.type) {
      case 'cursor':
        return this.tasks.push(this.cursor(target, query.cursor))
      case 'record':
        const record = target as Record<string, any>
        for (const [key, subQuery] of entries(query.fields)) {
          record[key] = this.resultType(subQuery)
          switch (subQuery.type) {
            case 'expr':
              return
            default:
              this.enqueue(record[key], subQuery)
          }
        }
        return
      default:
        throw new Error('Invalid query')
    }
  }

  async resolve(): Promise<any> {
    const target = this.resultType(this.query)
    this.enqueue(target, this.query)
    await Promise.all(this.tasks)
    return target
  }
}

export function createResolver(store: Store, config: Config) {
  return async function resolve<T>(query: PageQuery<T>): Promise<T> {
    // This validates the input, and throws if it's invalid
    const data = QueryData.adt(query)
    return new QueryResolver(store, config, data).resolve()
  }
}
