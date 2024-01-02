import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {RecordShape} from '../shape/RecordShape.js'
import {UnionMutator, UnionRow, UnionShape} from '../shape/UnionShape.js'

export class UnionField<Row, Options extends FieldOptions> extends Field<
  UnionRow & Row,
  UnionMutator<Row>,
  Options
> {
  constructor(
    shapes: {[key: string]: RecordShape<any>},
    meta: FieldMeta<UnionRow & Row, UnionMutator<Row>, Options>
  ) {
    super({
      shape: new UnionShape<Row>(
        meta.label,
        shapes,
        meta.initialValue,
        meta.postProcess
      ),
      ...meta
    })
  }
}
