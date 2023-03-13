import {Callable} from 'rado/util/Callable'
import {Query, QueryData} from './pages/Query.js'
import {Target} from './pages/Target.js'

const {create} = Object

export interface Pages<T> extends Callable {
  <S>(select: S): Promise<Query.Infer<S>>
}

export class Pages<T> extends Callable {
  types: {[K in keyof T]: Target<T[K]>}

  constructor(fetch: <T>(query: Query<T>) => Promise<T>) {
    super((input: any) => {
      const select = QueryData(input)
      return fetch(select)
    })
    this.types = new Proxy(create(null), {
      get(types, type) {
        if (type in types) return types[type]
        if (typeof type === 'string')
          return (types[type] = Target.create([type]))
      }
    })
  }
}

/*
interface Home {
  x: Expr<1>
}

const pages = new Pages<{Home: Home}>()

import {main} from '@alinea/content'

const {Home} = content.

const home = Home[1]()
const y = pages({
  home: home.with({

  }),
  children: home.children
})
*/
