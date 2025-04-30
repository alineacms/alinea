import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Type} from '../Type.js'
import type {RecordMutator} from '../shape/RecordShape.js'

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
      ...meta
    })
  }
}
