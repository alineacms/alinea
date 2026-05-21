import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import type {RecordShape} from '../shape/RecordShape.js'
import {Type} from '../Type.js'
import {
  type UnionMutator,
  UnionRow,
  UnionShape
} from '../shape/UnionShape.js'
import {entries} from '../util/Objects.js'

export class UnionField<
  StoredValue extends UnionRow,
  QueryValue,
  Options extends FieldOptions<StoredValue>
> extends Field<StoredValue, QueryValue, UnionMutator<StoredValue>, Options> {
  constructor(
    schema: Schema,
    shapes: Record<string, RecordShape<any>>,
    meta: FieldMeta<StoredValue, QueryValue, UnionMutator<StoredValue>, Options>
  ) {
    const customQueryValue = meta.queryValue
    const shape = new UnionShape<StoredValue>(
      meta.options.label,
      shapes,
      meta.options.initialValue
    )
    super({
      shape,
      referencedViews: schema ? Schema.referencedViews(schema) : [],
      ...meta,
      async queryValue(value, loader) {
        if (!value) return value as QueryValue
        const type = schema?.[value[UnionRow.type]]
        if (type) {
          const record = value as Record<string, unknown>
          await Promise.all(
            entries(Type.fields(type)).map(async ([key, field]) => {
              record[key] = await Field.queryValue(field, record[key], loader)
            })
          )
        }
        if (customQueryValue) return customQueryValue(value, loader)
        return value as unknown as QueryValue
      }
    })
  }
}
