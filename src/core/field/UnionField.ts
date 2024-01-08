import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {RecordShape} from '../shape/RecordShape.js'
import {UnionMutator, UnionRow, UnionShape} from '../shape/UnionShape.js'

export class UnionField<
  Row extends UnionRow,
  Options extends FieldOptions<Row>
> extends Field<Row, UnionMutator<Row>, Options> {
  constructor(
    shapes: {[key: string]: RecordShape<any>},
    meta: FieldMeta<Row, UnionMutator<Row>, Options>
  ) {
    super({
      shape: new UnionShape<Row>(
        meta.options.label,
        shapes,
        meta.options.initialValue,
        meta.postProcess
      ),
      ...meta
    })
  }
}
