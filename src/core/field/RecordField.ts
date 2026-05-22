import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Type} from '../Type.js'
import type {RecordMutator} from '../shape/RecordShape.js'
import {entries} from '../util/Objects.js'

export class RecordField<Row, Options extends FieldOptions<Row>> extends Field<
  Row,
  Row,
  RecordMutator<Row>,
  Options
> {
  constructor(
    type: Type,
    meta: FieldMeta<Row, Row, RecordMutator<Row>, Options>
  ) {
    super({
      shape: Type.shape(type) as any,
      referencedViews: Type.referencedViews(type),
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
