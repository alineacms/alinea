import {Callable} from 'rado/util/Callable'
import {Query, QueryData} from './pages/Query.js'
import {Target} from './pages/Target.js'

const {create} = Object

export interface Pages<T> extends Callable {
  <S>(select: S): Promise<Query.Infer<S>>
}

export class Pages<T> extends Callable {
  types: {[K in keyof T]: Target<T[K]>}

  constructor(fetch: <T>(query: QueryData) => Promise<T>) {
    super(async (input: any) => {
      return fetch(QueryData(input))
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
