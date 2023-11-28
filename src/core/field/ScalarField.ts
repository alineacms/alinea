import {Field, FieldMeta} from '../Field.js'
import {ScalarShape} from '../shape/ScalarShape.js'

export class ScalarField<Value, Options> extends Field<
  Value,
  (value: Value) => void,
  Options
> {
  constructor(meta: FieldMeta<Value, (value: Value) => void, Options>) {
    super({
      shape: new ScalarShape(meta.label, meta.initialValue),
      ...meta
    })
  }
}
