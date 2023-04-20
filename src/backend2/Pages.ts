import {Callable} from 'rado/util/Callable'
import {QueryData} from './pages/Selection.js'
import {Target} from './pages/Target.js'

const {create} = Object

type PageTypes<T> = {
  [K in keyof T]: Target<T[K]>
}

export interface Pages<T> extends Callable {
  <S>(select: S): Promise<Query.Infer<S>>
  <S>(select: (types: PageTypes<T>) => S): Promise<Query.Infer<S>>
}

export class Pages<T> extends Callable {
  types: PageTypes<T>

  constructor(fetch: <T>(query: QueryData) => Promise<T>) {
    super(async (select: any) => {
      const query = QueryData(select)
      return fetch(query)
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
