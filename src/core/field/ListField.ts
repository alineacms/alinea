import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {createId} from '../Id.js'
import {ListMutator, ListRow, ListShape} from '../shape/ListShape.js'
import {RecordShape} from '../shape/RecordShape.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'

export class ListField<
  StoredValue extends ListRow,
  QueryValue,
  Options extends FieldOptions<Array<StoredValue>>
> extends Field<
  Array<StoredValue>,
  Array<QueryValue>,
  ListMutator<StoredValue>,
  Options
> {
  constructor(
    shape: {[key: string]: RecordShape<any>},
    meta: FieldMeta<
      Array<StoredValue>,
      Array<QueryValue>,
      ListMutator<StoredValue>,
      Options
    >
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

export class ListEditor<StoredRow extends ListRow> {
  constructor(private rows: Array<StoredRow> = []) {}

  insertAt<Key extends StoredRow['_type']>(
    insertAt: number,
    type: Key,
    row: ListRowInput<StoredRow, Key>
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

  add<Key extends StoredRow['_type']>(
    type: Key,
    row: ListRowInput<StoredRow, Key>
  ) {
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
