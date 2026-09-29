import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import {type UnionMutator, UnionRow} from '../UnionRow.js'
import {entries, isRecord} from '../util/Objects.js'
import {stableId} from '../util/StableId.js'
import {typedFromYaml, typedToYaml} from '../util/TypedYaml.js'

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
    const customLocalizeLinks = meta.localizeLinks
    super({
      referencedViews: schema ? Schema.referencedViews(schema) : [],
      ...meta,
      defaultValue() {
        return meta.options.initialValue ?? ({} as StoredValue)
      },
      withInitialValue(value) {
        if (!value) return value
        const type = schema[value[UnionRow.type]]
        if (!type) return value
        return Type.withInitialValue(type, value) as StoredValue
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
      toYaml(value) {
        const row: unknown = value
        if (!isRecord(row) || typeof row._type !== 'string') return value
        const {_id, _index, _type, ...data} = row
        const type = schema?.[_type]
        return typedToYaml(_type, type ? Type.toYaml(type, data) : data)
      },
      fromYaml(value, {path}) {
        const typed = typedFromYaml(value)
        if (!typed) return value
        const [_type, data] = typed
        const type = schema?.[_type]
        return {
          [UnionRow.id]: stableId(path),
          [UnionRow.type]: _type,
          ...(type ? Type.fromYaml(type, data, path) : data)
        }
      },
      references(value, context) {
        const result = customReferences?.(value, context) ?? []
        if (!value) return result
        const type = schema?.[value[UnionRow.type]]
        if (type) result.push(...Type.references(type, value, context.path))
        return result
      },
      anchors(value, context) {
        const result: ReturnType<typeof Type.anchors> = []
        if (!value) return result
        const type = schema?.[value[UnionRow.type]]
        if (type) result.push(...Type.anchors(type, value, context.path))
        return result
      },
      normalizeAnchors(value, context) {
        if (!value) return value
        const type = schema?.[value[UnionRow.type]]
        if (!type) return value
        return Type.normalizeAnchors(type, value, context) as StoredValue
      },
      localizeLinks(value, context) {
        const localized = customLocalizeLinks
          ? customLocalizeLinks(value, context)
          : value
        if (!localized) return localized
        const type = schema?.[localized[UnionRow.type]]
        if (!type) return localized
        return Type.localizeLinks(type, localized, context) as StoredValue
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
