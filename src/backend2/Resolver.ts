import {Config} from 'alinea/core'
import {EntryTree} from './collection/EntryTree.js'
import {CursorData} from './pages/Cursor.js'
import {Query as PageQuery, QueryData as PageQueryData} from './pages/Query.js'
import {Store} from './Store.js'

const {entries, assign} = Object

class QueryResolver<T> {
  tasks: Array<Promise<void>> = []

  constructor(
    protected store: Store,
    protected config: Config,
    protected query: PageQuery<T>
  ) {}

  select(row: any) {}

  async cursor(target: unknown, query: CursorData) {
    const condition = query.target?.[0]
      ? EntryTree.type.is(query.target[0])
      : true
    const entries = EntryTree(condition)
      .take(query.limit?.[0])
      .skip(query.limit?.[1])
    const isSingle = query.first
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
    switch (query[0]) {
      case 'cursor':
        return query[1].first ? {} : []
      case 'record':
        return {}
      case 'expr':
        switch (query[1][0]) {
          case 'value':
            return query[1][1]
          default:
            throw new Error('Invalid query')
        }
    }
  }

  enqueue(target: unknown, query: PageQuery<T>) {
    switch (query[0]) {
      case 'cursor':
        return this.tasks.push(this.cursor(target, query[1]))
      case 'record':
        const record = target as Record<string, any>
        for (const [key, subQuery] of entries(query[1])) {
          record[key] = this.resultType(subQuery)
          switch (subQuery[0]) {
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

  async resolve(): Promise<T> {
    const target = this.resultType(this.query)
    this.enqueue(target, this.query)
    await Promise.all(this.tasks)
    return target
  }
}

export function createResolver(store: Store, config: Config) {
  return async function resolve<T>(query: PageQuery<T>): Promise<T> {
    // 1 validate the query data structure
    // todo
    // 2 translate into a database query

    // 3 iterate over results & post process fields
    // 4 return the result
    return new QueryResolver<T>(store, config, query).resolve()
  }
}
