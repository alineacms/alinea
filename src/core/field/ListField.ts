import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {createId} from '../Id.js'
import {ListMutator, ListRow, ListShape} from '../shape/ListShape.js'
import {RecordShape} from '../shape/RecordShape.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'

export class ListField<
  Row extends ListRow,
  Options extends FieldOptions<Array<Row>>
> extends Field<Array<Row>, ListMutator<Row>, Options> {
  constructor(
    shape: {[key: string]: RecordShape<any>},
    meta: FieldMeta<Array<Row>, ListMutator<Row>, Options>
  ) {
    super({
      shape: new ListShape(
        meta.options.label,
        shape,
        meta.options.initialValue,
        meta.postProcess
      ),
      ...meta
    })
  }
}

export type ListRowInput<Row extends ListRow, Key extends Row['_type']> = Omit<
  Extract<Row, {_type: Key}>,
  '_type' | '_id' | '_index'
>

export class ListEditor<Row extends ListRow> {
  constructor(private rows: Array<Row> = []) {}

  insertAt<Key extends Row['_type']>(
    insertAt: number,
    type: Key,
    row: ListRowInput<Row, Key>
  ) {
    const id = createId()
    const before = insertAt - 1
    const after = before + 1
    const keyA = this.rows[before]?._index || null
    const keyB = this.rows[after]?._index || null
    this.rows.push({
      _id: id,
      _index: generateKeyBetween(keyA, keyB),
      _type: type,
      ...row
    } as any)
    return this
  }

  add<Key extends Row['_type']>(type: Key, row: ListRowInput<Row, Key>) {
    return this.insertAt(this.rows.length, type, row)
  }

  removeAt(index: number) {
    this.rows.splice(index, 1)
    return this
  }

  value() {
    return this.rows
  }
}
