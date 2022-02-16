import {Cursor} from './Cursor'
import {Expr, ExprData} from './Expr'
import {From} from './From'
import {Selection, SelectionData} from './Selection'

type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
}

export class Collection<Row extends {} = any> extends Cursor<Row> {
  constructor(name: string, options: CollectionOptions = {}) {
    const {flat, columns, where, alias} = options
    const from = flat
      ? From.Table(name, columns || [], alias)
      : From.Column(From.Table(name, ['data'], alias), 'data')
    super({
      from,
      selection: SelectionData.Row(from),
      where: where?.expr
    })
  }

  get<T>(name: string): Expr<T> {
    return new Expr(ExprData.Field(From.path(this.cursor.from).concat(name)))
  }

  get id(): Expr<string> {
    return this.get('id')
  }

  get fields(): Selection<Row> {
    return new Selection(this.cursor.selection)
  }

  with<S>(that: S) {
    return this.fields.with(that)
  }

  as(name: string): Collection<Row> {
    return new Collection(From.source(this.cursor.from), {
      alias: name,
      where: this.cursor.where ? new Expr(this.cursor.where) : undefined
    })
  }
}
