import {Field, type FieldMeta} from '../Field.js'

export class ScalarField<Value, Options> extends Field<
  Value,
  Value,
  (value: Value) => void,
  Options
> {
  constructor(meta: FieldMeta<Value, Value, (value: Value) => void, Options>) {
    super({
      referencedViews: [],
      defaultValue() {
        return meta.options.initialValue as Value
      },
      searchableText(value) {
        if (!(meta.options as {searchable?: boolean}).searchable) return ''
        const stringified = String(value ?? '')
        return stringified ? ` ${stringified}` : ''
      },
      ...meta
    })
  }
}
