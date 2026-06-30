import {Field, type FieldData, type FieldOptions} from '../Field.js'
import {Type} from '../Type.js'
import {entries} from '../util/Objects.js'

export type RecordMutator<T> = {
  set: <K extends keyof T>(k: K, v: T[K]) => void
}

export class RecordField<Row, Options extends FieldOptions<Row>> extends Field<
  Row,
  Row,
  RecordMutator<Row>,
  Options
> {
  constructor(
    type: Type,
    meta: FieldData<Row, Row, RecordMutator<Row>, Options>
  ) {
    super({
      referencedViews: Type.referencedViews(type),
      defaultValue() {
        return Type.initialValue(type) as Row
      },
      applyLinks(value, loader) {
        return Type.applyLinks(type, value as Record<string, unknown>, loader)
      },
      searchableText(value) {
        const text = Type.searchableText(type, value)
        return text ? ` ${text}` : ''
      },
      references(value, context) {
        return Type.references(
          type,
          (value ?? {}) as Record<string, unknown>,
          context.path
        )
      },
      async queryValue(value, loader) {
        const row = (value ?? {}) as Record<string, unknown>
        await Promise.all(
          entries(Type.fields(type)).map(async ([key, field]) => {
            row[key] = await Field.queryValue(field, row[key], loader)
          })
        )
        return row as Row
      },
      beforeSave({value, ...context}) {
        if (value === undefined || value === null) return value
        return Type.beforeSave(
          type,
          value as Record<string, unknown>,
          context
        ) as Row
      },
      ...meta
    })
  }
}
