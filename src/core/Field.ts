import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import {Expr} from './Expr.js'
import {getField, hasField, HasField, internalField} from './Internal.js'
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

export interface FieldMeta<StoredValue, QueryValue, Mutator, Options> {
  options: Options & FieldOptions<StoredValue>
  view: View<{
    field: Field<StoredValue, QueryValue, Mutator, Options>
  }>
  postProcess?: (value: StoredValue, loader: LinkResolver) => Promise<void>
}

export interface FieldData<StoredValue, QueryValue, Mutator, Options>
  extends FieldMeta<StoredValue, QueryValue, Mutator, Options> {
  shape: Shape<StoredValue, Mutator>
  referencedViews: Array<string>
}

export interface FieldInternal extends FieldData<any, any, any, any> {
  ref: symbol
}

declare const brand: unique symbol
export class Field<
    StoredValue = any,
    QueryValue = any,
    Mutator = any,
    Options = any
  >
  extends Expr<QueryValue>
  implements HasField
{
  declare [brand]: [StoredValue, QueryValue, Mutator, Options];

  [internalField]: FieldInternal
  constructor(data: FieldData<StoredValue, QueryValue, Mutator, Options>) {
    super({type: 'field'})
    this[internalField] = {ref: Symbol(), ...data}
  }
}

export namespace Field {
  // Todo: because we wrap fields in an Expr proxy we need this
  // reference - but maybe we shouldn't wrap in the future
  export function ref(field: HasField): symbol {
    return getField(field).ref
  }

  export function shape(field: HasField): Shape {
    return getField(field).shape
  }

  export function label(field: HasField): string {
    return getField(field).options.label
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
    return getField(field).view
  }

  export function referencedViews(field: Field): Array<string> {
    const fieldView = Field.view(field)
    if (typeof fieldView === 'string')
      return [fieldView, ...getField(field).referencedViews]
    return getField(field).referencedViews
  }

  export function options<
    StoredValue,
    QueryValue,
    Options extends FieldOptions<StoredValue>
  >(field: Field<StoredValue, QueryValue, any, Options>): Options {
    return getField(field).options
  }

  export function isField(value: any): value is Field {
    return value && hasField(value)
  }
}
