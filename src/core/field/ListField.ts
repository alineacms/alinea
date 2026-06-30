import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {createId} from '../Id.js'
import {ListRow} from '../ListRow.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'
import {entries} from '../util/Objects.js'

export interface ListMutator<Row> {
  replace(id: string, row: Row): void
  push(row: Omit<Row, '_id' | '_index'>, insertAt?: number): void
  remove(id: string): void
  move(oldIndex: number, newIndex: number): void
  read(id: string): Row | undefined
}

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
    meta: FieldMeta<
      Array<StoredValue>,
      Array<QueryValue>,
      ListMutator<StoredValue>,
      Options
    >
  ) {
    const customQueryValue = meta.queryValue
    const customReferences = meta.references
    super({
      referencedViews: Schema.referencedViews(schema),
      ...meta,
      defaultValue() {
        return meta.options.initialValue ?? []
      },
      async applyLinks(value, loader) {
        const rows = Array.isArray(value) ? value : []
        await Promise.all(
          rows.map(async row => {
            const type = schema[row[ListRow.type]]
            if (!type) return
            await Type.applyLinks(type, row as Record<string, unknown>, loader)
          })
        )
      },
      searchableText(value) {
        let res = ''
        const rows = Array.isArray(value) ? value : []
        for (const row of rows) {
          const type = schema[row[ListRow.type]]
          if (type) {
            const text = Type.searchableText(type, row)
            if (text) res += ` ${text}`
          }
        }
        return res
      },
      references(value, context) {
        const result = customReferences?.(value, context) ?? []
        const rows = Array.isArray(value) ? value : []
        for (const row of rows) {
          const type = schema[row[ListRow.type]]
          if (!type) continue
          const segment = row[ListRow.id] || String(rows.indexOf(row))
          result.push(
            ...Type.references(type, row as Record<string, unknown>, [
              ...context.path,
              segment
            ])
          )
        }
        return result
      },
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
