import {Callable} from 'rado/util/Callable'
import {Expr} from './pages/Expr.js'
import {Query, QueryData} from './pages/Query.js'
import {Target} from './pages/Target.js'
import {Tree} from './pages/Tree.js'

const {create} = Object

interface Fields {
  [key: string]: Expr<any> | {[Target.IsTarget]: true} | ((tree: Tree) => any)
}

export interface Pages<T> extends Callable {
  <S>(select: S): Promise<Query.Infer<S>>
}

export class Pages<T> extends Callable {
  types: {[K in keyof T]: Target<T[K]>}

  constructor(fetch: <T>(query: QueryData) => Promise<T>) {
    super(async (select: any) => {
      return fetch(QueryData(select))
    })
    this.types = new Proxy(create(null), {
      get(types, type) {
        if (type in types) return types[type]
        if (typeof type === 'string')
          return (types[type] = Target.create({name: type}))
      }
    })
  }
}
