import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import type {RecordShape} from '../shape/RecordShape.js'
import {
  type UnionMutator,
  type UnionRow,
  UnionShape
} from '../shape/UnionShape.js'

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
    super({
      shape: new UnionShape<StoredValue>(
        meta.options.label,
        shapes,
        meta.options.initialValue,
        meta.postProcess
      ),
      referencedViews: schema ? Schema.referencedViews(schema) : [],
      ...meta
    })
  }
}
