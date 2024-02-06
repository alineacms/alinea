import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import {Expr} from 'alinea/core/pages/Expr'
import type {ComponentType} from 'react'
import {Hint} from './Hint.js'
import {Shape} from './Shape.js'

export interface FieldOptions<Value> {
  /** A description of the field */
  label: string
  /** Hide this field in the dashboard */
  hidden?: boolean
  /** Mark this field as read-only */
  readOnly?: boolean
  /** The initial value of the field */
  initialValue?: Value
  /** The value of this field is shared across all languages */
  shared?: boolean
  /** Providing a value for this field is required */
  required?: boolean
  /** Validate the given value */
  validate?(value: Value): boolean | string | undefined
}

export type WithoutLabel<Options extends FieldOptions<any>> = Omit<
  Options,
  'label'
>

export interface FieldMeta<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
> {
  hint: Hint
  options: Options
  view?: FieldView<Value, Mutator, Options>
  postProcess?: (value: Value, loader: LinkResolver) => Promise<void>
}

export interface FieldData<Value, Mutator, Options extends FieldOptions<Value>>
  extends FieldMeta<Value, Mutator, Options> {
  shape: Shape<Value, Mutator>
}

export type FieldView<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
> = ComponentType<{
  field: Field<Value, Mutator, Options>
}>

export interface Field<Value, Mutator, Options extends FieldOptions<Value>>
  extends Expr<Value> {
  [Field.Data]: FieldData<Value, Mutator, Options>
  [Field.Ref]: symbol
}

export class Field<
  Value = any,
  Mutator = any,
  Options extends FieldOptions<Value> = FieldOptions<Value>
> {
  static index = 0
  constructor(data: FieldData<Value, Mutator, Options>) {
    this[Field.Data] = data
    this[Field.Ref] = Symbol(`Field.${data.options.label}.${Field.index++}`)
  }
}

export namespace Field {
  export const Data = Symbol.for('@alinea/Field.Data')
  export const Value = Symbol.for('@alinea/Field.Value')
  export const Ref = Symbol.for('@alinea/Field.Self')

  export function provideView<
    Value,
    Mutator,
    Options extends FieldOptions<Value>,
    Factory extends (...args: Array<any>) => Field<Value, Mutator, Options>
  >(view: FieldView<Value, Mutator, Options>, factory: Factory): Factory {
    return ((...args: Array<any>) =>
      new Field({...factory(...args)[Field.Data], view})) as Factory
  }

  // Todo: because we wrap fields in an Expr proxy we need this
  // reference - but maybe we shouldn't wrap in the future
  export function ref(field: Field): symbol {
    return field[Field.Ref]
  }

  export function shape(field: Field<any, any>): Shape {
    return field[Field.Data].shape
  }

  export function hint(field: Field): Hint {
    return field[Field.Data].hint
  }

  export function label(field: Field): string {
    return field[Field.Data].options.label
  }

  export function view<Value, Mutator, Options extends FieldOptions<Value>>(
    field: Field<Value, Mutator, Options>
  ): FieldView<Value, Mutator, Options> | undefined {
    return field[Field.Data].view
  }

  export function options<Value, Options extends FieldOptions<Value>>(
    field: Field<Value, any, Options>
  ): Options {
    return field[Field.Data].options
  }

  export function isField(value: any): value is Field {
    return value && Boolean(value[Field.Data])
  }
}
