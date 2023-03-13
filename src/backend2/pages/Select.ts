import {Callable} from 'rado/util/Callable'
import {Cursor, CursorData} from './Cursor.js'
import {Page} from './Page.js'
import {Query, QueryData} from './Query.js'

export interface Select<Row> extends Callable {
  <S>(select: S): Select<Query.Infer<S>>
}

export class Select<Row> extends Cursor<Array<Row>> {
  constructor(data: CursorData) {
    super(data, function select(input: any) {
      return new Select({...data, select: QueryData(input)})
    })
  }

  with<S>(select: S): Select<Query.Combine<Row, S>> {
    return new Select({...this[Cursor.Data], select: QueryData(select)})
  }

  only<S>(select: S): Select<Query.Infer<S>> {
    return new Select({...this[Cursor.Data], select: QueryData(select)})
  }

  first(): SelectFirst<Row> {
    return new SelectFirst({...this[Cursor.Data], first: true})
  }
}

export interface SelectFirst<Row> extends Callable {
  <S>(select: S): SelectFirst<Query.Infer<S>>
}

export class SelectFirst<Row> extends Cursor<Row> {
  constructor(data: CursorData) {
    super(data, function selectFirst(input: any) {
      return new SelectFirst({
        ...data,
        select: QueryData(input),
        first: true
      })
    })
  }

  with<S>(select: S): SelectFirst<Row & Query.Infer<S>> {
    return new SelectFirst({
      ...this[Cursor.Data],
      select: QueryData(select)
    })
  }

  only<S>(select: S): SelectFirst<Query.Infer<S>> {
    return new SelectFirst({
      ...this[Cursor.Data],
      select: QueryData(select)
    })
  }

  prev(): Select<Page> {
    return new Select({traverse: ['prev', this[Cursor.Data]]})
  }

  next(): Select<Page> {
    return new Select({traverse: ['next', this[Cursor.Data]]})
  }

  children<T = Page>(define?: Select<T>): Select<T> {
    return new Select({traverse: ['children', this[Cursor.Data]]})
  }

  parents<T = Page>(define?: Select<T>): Select<T> {
    return new Select({traverse: ['parents', this[Cursor.Data]]})
  }
}
