import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {ScalarShape} from '../shape/ScalarShape.js'

export class ScalarField<
  Value,
  Options extends FieldOptions<Value> & {searchable?: boolean}
> extends Field<Value, (value: Value) => void, Options> {
  constructor(meta: FieldMeta<Value, (value: Value) => void, Options>) {
    super({
      shape: new ScalarShape(
        meta.options.label,
        meta.options.initialValue,
        meta.options.searchable
      ),
      ...meta
    })
  }
}
