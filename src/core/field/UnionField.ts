import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {RecordShape} from '../shape/RecordShape.js'
import {UnionMutator, UnionRow, UnionShape} from '../shape/UnionShape.js'

export class UnionField<
  StoredValue extends UnionRow,
  QueryValue,
  Options extends FieldOptions<StoredValue>
> extends Field<StoredValue, QueryValue, UnionMutator<StoredValue>, Options> {
  constructor(
    shapes: {[key: string]: RecordShape<any>},
    meta: FieldMeta<StoredValue, QueryValue, UnionMutator<StoredValue>, Options>
  ) {
    super({
      shape: new UnionShape<StoredValue>(
        meta.options.label,
        shapes,
        meta.options.initialValue,
        meta.postProcess
      ),
      ...meta
    })
  }
}
