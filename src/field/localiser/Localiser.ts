import type {FieldOptions} from '#/core/Field.js'
import {Field} from '#/core/Field.js'
import {getField} from '#/core/Internal.js'
import type {Shape} from '#/core/Shape.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {LocalisedShape, type LocalisedValue} from './LocalisedShape.js'

export interface Localisation<Locale extends string = string, Value = unknown> {
  locales: ReadonlyArray<Locale>
  fallback?: (requested: Locale) => ReadonlyArray<Locale>
  inner: Field<Value, unknown, unknown, FieldOptions<Value>>
}

export class LocalisedField<
  Locale extends string,
  StoredValue,
  QueryValue,
  Options
> extends Field<
  LocalisedValue<Locale, StoredValue>,
  QueryValue,
  (value: LocalisedValue<Locale, StoredValue>) => void,
  Omit<Options, 'initialValue' | 'validate'> &
    FieldOptions<LocalisedValue<Locale, StoredValue>>
> {
  constructor(
    data: ConstructorParameters<
      typeof Field<
        LocalisedValue<Locale, StoredValue>,
        QueryValue,
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

interface LocaliserOptions<Locale extends string> {
  locales: ReadonlyArray<Locale>
  fallback?: (requested: Locale) => ReadonlyArray<Locale>
}

export function localiser<const Locale extends string>({
  locales,
  fallback
}: LocaliserOptions<Locale>) {
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
          FieldOptions<LocalisedValue<Locale, StoredValue>>,
        async queryValue(value, loader) {
          const selected = selectLocalisedValue(
            value ?? shape.create(),
            loader.locale,
            locales,
            fallback,
            data.shape as Shape<StoredValue>
          )
          return Field.queryValue(field, selected, loader)
        }
      },
      {
        locales,
        fallback,
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

function selectLocalisedValue<Locale extends string, Value>(
  value: LocalisedValue<Locale, Value>,
  locale: string | null,
  locales: ReadonlyArray<Locale>,
  fallback: ((requested: Locale) => ReadonlyArray<Locale>) | undefined,
  shape: Shape<Value>
): Value {
  const requested = selectLocale(locale, locales)
  const directValue = value[requested]
  if (isAvailable(directValue)) return directValue
  const fallbacks = fallback?.(requested) ?? []
  for (const fallbackLocale of fallbacks) {
    const fallbackValue = value[fallbackLocale]
    if (isAvailable(fallbackValue)) return fallbackValue
  }
  return directValue === undefined ? shape.create() : directValue
}

function selectLocale<Locale extends string>(
  locale: string | null,
  locales: ReadonlyArray<Locale>
): Locale {
  const matchingLocale = locales.find(
    candidate => candidate.toLowerCase() === locale?.toLowerCase()
  )
  return matchingLocale ?? locales[0]
}

function isAvailable<Value>(value: Value | undefined): value is Value {
  return value !== undefined && value !== null && value !== ''
}
