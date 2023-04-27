import {Callable} from 'rado/util/Callable'
import {Selection} from './pages/Selection.js'

export interface Pages extends Callable {
  <S>(select: S): Promise<Selection.Infer<S>>
}

export class Pages extends Callable {
  constructor(fetch: <T>(selection: Selection<T>) => Promise<T>) {
    super(async (select: any) => {
      return fetch(Selection(select))
    })
  }
}
