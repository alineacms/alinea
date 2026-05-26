import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import {type UnionMutator, UnionRow} from '../UnionRow.js'
import {entries} from '../util/Objects.js'

export class UnionField<
  StoredValue extends UnionRow,
  QueryValue,
  Options extends FieldOptions<StoredValue>
> extends Field<StoredValue, QueryValue, UnionMutator<StoredValue>, Options> {
  constructor(
    schema: Schema,
    meta: FieldMeta<StoredValue, QueryValue, UnionMutator<StoredValue>, Options>
  ) {
    const customQueryValue = meta.queryValue
    const customReferences = meta.references
    super({
      referencedViews: schema ? Schema.referencedViews(schema) : [],
      ...meta,
      defaultValue() {
        return meta.options.initialValue ?? ({} as StoredValue)
      },
      async applyLinks(value, loader) {
        if (!value) return
        const type = schema?.[value[UnionRow.type]]
        if (type) await Type.applyLinks(type, value, loader)
      },
      searchableText(value) {
        if (!value) return ''
        const type = schema?.[value[UnionRow.type]]
        return type ? Type.searchableText(type, value) : ''
      },
      references(value, context) {
        const result = customReferences?.(value, context) ?? []
        if (!value) return result
        const type = schema?.[value[UnionRow.type]]
        if (type) result.push(...Type.references(type, value, context.path))
        return result
      },
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
