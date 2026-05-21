import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {createId} from '../Id.js'
import {Schema} from '../Schema.js'
import {type ListMutator, ListRow, ListShape} from '../shape/ListShape.js'
import {Type} from '../Type.js'
import type {RecordShape} from '../shape/RecordShape.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'
import {entries} from '../util/Objects.js'

export class ListField<
  StoredValue extends ListRow,
  QueryValue,
  Options extends FieldOptions<Array<unknown>>
> extends Field<
  Array<StoredValue>,
  Array<QueryValue>,
  ListMutator<StoredValue>,
  Options
> {
  constructor(
    schema: Schema,
    shapes: Record<string, RecordShape<any>>,
    meta: FieldMeta<
      Array<StoredValue>,
      Array<QueryValue>,
      ListMutator<StoredValue>,
      Options
    >
  ) {
    const customQueryValue = meta.queryValue
    const shape = new ListShape(
      meta.options.label,
      shapes,
      meta.options.initialValue
    )
    super({
      shape,
      referencedViews: Schema.referencedViews(schema),
      ...meta,
      async queryValue(value, loader) {
        const rows = Array.isArray(value) ? value : []
        await Promise.all(
          rows.map(async row => {
            const type = schema[row[ListRow.type]]
            if (!type) return
            const record = row as Record<string, unknown>
            await Promise.all(
              entries(Type.fields(type)).map(async ([key, field]) => {
                record[key] = await Field.queryValue(field, record[key], loader)
              })
            )
          })
        )
        if (customQueryValue) return customQueryValue(rows, loader)
        return rows as unknown as Array<QueryValue>
      }
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
