import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import {Expr} from 'alinea/core/pages/Expr'
import {Shape} from './Shape.js'
import {View} from './View.js'

export interface FieldOptions<StoredValue> {
  /** A description of the field */
  label: string
  /** Hide this field in the dashboard */
  hidden?: boolean
  /** Mark this field as read-only */
  readOnly?: boolean
  /** The initial value of the field */
  initialValue?: StoredValue
  /** The value of this field is shared across all languages */
  shared?: boolean
  /** Providing a value for this field is required */
  required?: boolean
  /** Validate the given value */
  validate?(value: StoredValue): boolean | string | undefined
}

export type WithoutLabel<Options extends FieldOptions<any>> = Omit<
  Options,
  'label'
>

export interface FieldMeta<
  StoredValue,
  QueryValue,
  Mutator,
  Options extends FieldOptions<StoredValue>
> {
  options: Options
  view: View<{
    field: Field<StoredValue, QueryValue, Mutator, Options>
  }>
  postProcess?: (value: StoredValue, loader: LinkResolver) => Promise<void>
}

export interface FieldData<
  StoredValue,
  QueryValue,
  Mutator,
  Options extends FieldOptions<StoredValue>
> extends FieldMeta<StoredValue, QueryValue, Mutator, Options> {
  shape: Shape<StoredValue, Mutator>
  referencedViews: Array<string>
}

export interface Field<
  StoredValue,
  QueryValue,
  Mutator,
  Options extends FieldOptions<StoredValue>
> extends Expr<QueryValue> {
  [Field.Data]: FieldData<StoredValue, QueryValue, Mutator, Options>
  [Field.Ref]: symbol
}

export class Field<
  StoredValue = any,
  QueryValue = any,
  Mutator = any,
  Options extends FieldOptions<StoredValue> = FieldOptions<StoredValue>
> {
  static index = 0
  constructor(data: FieldData<StoredValue, QueryValue, Mutator, Options>) {
    this[Field.Data] = data
    this[Field.Ref] = Symbol(`Field.${data.options.label}.${Field.index++}`)
  }
}

export namespace Field {
  export const Data = Symbol.for('@alinea/Field.Data')
  export const Value = Symbol.for('@alinea/Field.Value')
  export const Ref = Symbol.for('@alinea/Field.Self')

  // Todo: because we wrap fields in an Expr proxy we need this
  // reference - but maybe we shouldn't wrap in the future
  export function ref(field: Field): symbol {
    return field[Field.Ref]
  }

  export function shape(field: Field<any, any>): Shape {
    return field[Field.Data].shape
  }

  export function label(field: Field): string {
    return field[Field.Data].options.label
  }

  export function view<
    StoredValue,
    QueryValue,
    Mutator,
    Options extends FieldOptions<StoredValue>
  >(
    field: Field<StoredValue, QueryValue, Mutator, Options>
  ): View<{
    field: Field<StoredValue, QueryValue, Mutator, Options>
  }> {
    return field[Field.Data].view
  }

  export function referencedViews(field: Field): Array<string> {
    const fieldView = Field.view(field)
    if (typeof fieldView === 'string')
      return [fieldView, ...field[Field.Data].referencedViews]
    return field[Field.Data].referencedViews
  }

  export function options<
    StoredValue,
    QueryValue,
    Options extends FieldOptions<StoredValue>
  >(field: Field<StoredValue, QueryValue, any, Options>): Options {
    return field[Field.Data].options
  }

  export function isField(value: any): value is Field {
    return value && Boolean(value[Field.Data])
  }
}
