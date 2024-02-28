import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {RecordMutator, RecordShape} from '../shape/RecordShape.js'

export class RecordField<Row, Options extends FieldOptions<Row>> extends Field<
  Row,
  Row,
  RecordMutator<Row>,
  Options
> {
  constructor(
    shape: RecordShape<any>,
    meta: FieldMeta<Row, Row, RecordMutator<Row>, Options>
  ) {
    super({shape, ...meta})
  }
}
