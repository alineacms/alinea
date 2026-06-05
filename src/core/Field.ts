import type {
  EntryReferenceTarget,
  FieldReferenceContext
} from '#/core/db/EntryReference.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {Expr} from './Expr.js'
import {type HasField, getField, hasField, internalField} from './Internal.js'
import type {User} from './User.js'
import type {View} from './View.js'

export interface FieldOptions<StoredValue> {
  /** A description of the field */
  label: string
  /** Hide this field in the dashboard */
  hidden?: boolean
  /** Display this field in overview listings */
  overview?: boolean
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
  queryValue?: (value: StoredValue, loader: LinkResolver) => Promise<QueryValue>
  references?: (
    value: StoredValue,
    context: FieldReferenceContext
  ) => Array<EntryReferenceTarget>
  beforeSave?: (context: FieldBeforeSaveContext<StoredValue>) => StoredValue
}

export type FieldBeforeSaveAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'translate'

export interface FieldBeforeSaveContext<StoredValue> {
  value: StoredValue
  action: FieldBeforeSaveAction
  user?: User | null
  now: Date
}

export interface FieldData<
  StoredValue,
  QueryValue,
  Mutator,
  Options
> extends FieldMeta<StoredValue, QueryValue, Mutator, Options> {
  referencedViews?: Array<string>
  defaultValue?: () => StoredValue
  applyLinks?: (value: StoredValue, loader: LinkResolver) => Promise<void>
  searchableText?: (value: StoredValue) => string
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

  export function label(field: HasField): string {
    return getField(field).options.label
  }

  export function initialValue(field: HasField): unknown {
    const data = getField(field)
    if ('initialValue' in data.options) return data.options.initialValue
    return data.defaultValue?.()
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
      return [fieldView, ...(getField(field).referencedViews ?? [])]
    return getField(field).referencedViews ?? []
  }

  export function options<
    StoredValue,
    QueryValue,
    Options extends FieldOptions<StoredValue>
  >(field: Field<StoredValue, QueryValue, any, Options>): Options {
    return getField(field).options
  }

  export async function queryValue<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>,
    value: StoredValue,
    loader: LinkResolver
  ): Promise<QueryValue> {
    const data = getField(field)
    if (data.queryValue) return data.queryValue(value, loader)
    if (data.applyLinks) await data.applyLinks(value, loader)
    return value as unknown as QueryValue
  }

  export function beforeSave<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>,
    value: StoredValue,
    context: Omit<FieldBeforeSaveContext<StoredValue>, 'value'>
  ): StoredValue {
    const data = getField(field)
    if (!data.beforeSave) return value
    return data.beforeSave({...context, value})
  }

  export async function applyLinks<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>,
    value: StoredValue,
    loader: LinkResolver
  ): Promise<void> {
    const data = getField(field)
    if (data.applyLinks) await data.applyLinks(value, loader)
  }

  export function searchableText<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>,
    value: StoredValue
  ): string {
    const data = getField(field)
    return data.searchableText?.(value) ?? ''
  }

  export function references<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>,
    value: StoredValue,
    context: FieldReferenceContext
  ): Array<EntryReferenceTarget> {
    const data = getField(field)
    return data.references?.(value, context) ?? []
  }

  export function isField(value: any): value is Field {
    return value && hasField(value)
  }
}
