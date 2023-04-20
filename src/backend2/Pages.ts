import {Callable} from 'rado/util/Callable'
import {Selection} from './pages/Selection.js'
import {Target} from './pages/Target.js'

const {create} = Object

type PageTypes<T> = [T] extends [{type: string}]
  ? {[K in T['type']]: Target<Extract<T, {type: K}>>}
  : any

export interface Pages<T> extends Callable {
  <S>(select: S): Promise<Selection.Infer<S>>
  <S>(select: (types: PageTypes<T>) => S): Promise<Selection.Infer<S>>
}

export class Pages<T> extends Callable {
  types: PageTypes<T>

  constructor(fetch: <T>(selection: Selection<T>) => Promise<T>) {
    super(async (select: any) => {
      return fetch(Selection(select))
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
