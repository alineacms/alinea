import type {FieldOptions} from '#/core/Field.js'
import {Field} from '#/core/Field.js'
import {getField} from '#/core/Internal.js'
import type {Shape} from '#/core/Shape.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {LocalisedShape, type LocalisedValue} from './LocalisedShape.js'

export interface Localisation<Locale extends string = string, Value = unknown> {
  locales: ReadonlyArray<Locale>
  inner: Field<Value, unknown, unknown, FieldOptions<Value>>
}

export class LocalisedField<
  Locale extends string,
  StoredValue,
  QueryValue,
  Options
> extends Field<
  LocalisedValue<Locale, StoredValue>,
  Record<Locale, QueryValue>,
  (value: LocalisedValue<Locale, StoredValue>) => void,
  Omit<Options, 'initialValue' | 'validate'> &
    FieldOptions<LocalisedValue<Locale, StoredValue>>
> {
  constructor(
    data: ConstructorParameters<
      typeof Field<
        LocalisedValue<Locale, StoredValue>,
        Record<Locale, QueryValue>,
        (value: LocalisedValue<Locale, StoredValue>) => void,
        Omit<Options, 'initialValue' | 'validate'> &
          FieldOptions<LocalisedValue<Locale, StoredValue>>
      >
    >[0],
    public localisation: Localisation<Locale, StoredValue>
  ) {
    super(data)
  }
}

export function localiser<const Locale extends string>(
  locales: ReadonlyArray<Locale>
) {
  if (locales.length === 0)
    throw new Error('Field localiser requires at least one locale')
  return function localise<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>
  ): LocalisedField<Locale, StoredValue, QueryValue, Options> {
    const data = getField(field)
    const shape = new LocalisedShape<Locale, StoredValue>(
      data.shape.label,
      locales,
      data.shape as Shape<StoredValue>
    )
    return new LocalisedField<Locale, StoredValue, QueryValue, Options>(
      {
        shape,
        referencedViews:
          typeof data.view === 'string'
            ? [data.view, ...data.referencedViews]
            : data.referencedViews,
        view: viewKeys.LocalisedInput,
        options: {
          ...data.options,
          initialValue: shape.initialValue
        } as Omit<Options, 'initialValue' | 'validate'> &
          FieldOptions<LocalisedValue<Locale, StoredValue>>
      },
      {
        locales,
        inner: field as Field<
          StoredValue,
          unknown,
          unknown,
          FieldOptions<StoredValue>
        >
      }
    )
  }
}
