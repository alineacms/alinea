import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import {Expr} from 'alinea/core/pages/Expr'
import type {ComponentType} from 'react'
import {Hint} from './Hint.js'
import {Label} from './Label.js'
import {Shape} from './Shape.js'

export interface FieldOptions {
  hidden?: boolean
  readOnly?: boolean
}

export interface FieldMeta<Value, Mutator, Options extends FieldOptions> {
  hint: Hint
  label: Label
  initialValue?: Value
  options: Options
  view?: FieldView<Value, Mutator, Options>
  postProcess?: (value: Value, loader: LinkResolver) => Promise<void>
}

export interface FieldData<Value, Mutator, Options extends FieldOptions>
  extends FieldMeta<Value, Mutator, Options> {
  shape: Shape<Value, Mutator>
}

export type FieldView<
  Value,
  Mutator,
  Options extends FieldOptions
> = ComponentType<{
  field: Field<Value, Mutator, Options>
}>

export interface Field<Value, Mutator, Options extends FieldOptions>
  extends Expr<Value> {
  [Field.Data]: FieldData<Value, Mutator, Options>
}

export class Field<
  Value = any,
  Mutator = any,
  Options extends FieldOptions = FieldOptions
> {
  constructor(data: FieldData<Value, Mutator, Options>) {
    this[Field.Data] = data
  }
}

export namespace Field {
  export const Data = Symbol.for('@alinea/Field.Data')

  export function provideView<
    Value,
    Mutator,
    Options extends FieldOptions,
    Factory extends (...args: Array<any>) => Field<Value, Mutator, Options>
  >(view: FieldView<Value, Mutator, Options>, factory: Factory): Factory {
    return ((...args: Array<any>) =>
      new Field({...factory(...args)[Field.Data], view})) as Factory
  }

  export function shape(field: Field<any, any>): Shape {
    return field[Field.Data].shape
  }

  export function hint(field: Field): Hint {
    return field[Field.Data].hint
  }

  export function view<Value, Mutator, Options extends FieldOptions>(
    field: Field<Value, Mutator, Options>
  ): FieldView<Value, Mutator, Options> | undefined {
    return field[Field.Data].view
  }

  export function options<Options extends FieldOptions>(
    field: Field<any, any, Options>
  ): Options {
    return field[Field.Data].options
  }

  export function isField(value: any): value is Field {
    return value && Boolean(value[Field.Data])
  }
}
