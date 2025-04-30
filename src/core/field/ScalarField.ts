import {Field, type FieldMeta} from '../Field.js'
import {ScalarShape} from '../shape/ScalarShape.js'

export class ScalarField<Value, Options> extends Field<
  Value,
  Value,
  (value: Value) => void,
  Options
> {
  constructor(meta: FieldMeta<Value, Value, (value: Value) => void, Options>) {
    super({
      shape: new ScalarShape(
        meta.options.label,
        meta.options.initialValue,
        (meta.options as {searchable?: boolean}).searchable
      ),
      referencedViews: [],
      ...meta
    })
  }
}
