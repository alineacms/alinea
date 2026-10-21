import type {FieldOptions} from '#/core/Field.js'
import {Field} from '#/core/Field.js'
import {getField} from '#/core/Internal.js'
import {entries, fromEntries, isRecord, keys} from '#/core/util/Objects.js'
import {fieldError} from '#/core/Validation.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {selectLocale} from './SelectLocale.js'

export type LocalisedValue<Locale extends string, Value> = Record<Locale, Value>

export interface Localisation<Locale extends string = string, Value = unknown> {
  /**
   * The locales of the value, undefined for a field that uses the locales of
   * the root of its entry
   */
  locales?: ReadonlyArray<Locale>
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

export interface LocaliserOptions<Locale extends string = string> {
  locales: ReadonlyArray<Locale>
  fallback?: (requested: Locale) => ReadonlyArray<Locale>
}

export interface SelectLocalisedValueOptions<Locale extends string, Value> {
  value: LocalisedValue<Locale, Value>
  locale: string | null
  locales: ReadonlyArray<Locale>
  fallback?: (requested: Locale) => ReadonlyArray<Locale>
  defaultValue?: Value
}

/** @deprecated Use `Field.localised(field, {locales})` */
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
    const initialValue = () => {
      return Object.fromEntries(
        locales.map(locale => [locale, Field.initialValue(field)])
      ) as LocalisedValue<Locale, StoredValue>
    }
    return new LocalisedField<Locale, StoredValue, QueryValue, Options>(
      {
        referencedViews:
          typeof data.view === 'string'
            ? [data.view, ...(data.referencedViews ?? [])]
            : data.referencedViews,
        view: viewKeys.LocalisedInput,
        options: {
          ...data.options,
          initialValue: initialValue()
        } as Omit<Options, 'initialValue' | 'validate'> &
          FieldOptions<LocalisedValue<Locale, StoredValue>>,
        defaultValue: initialValue,
        withInitialValue(value) {
          const record = value ?? initialValue()
          let next = record
          for (const locale of locales) {
            const before = record[locale]
            const after = Field.withInitialValue(field, before)
            if (after === before) continue
            if (next === record) next = {...record}
            next[locale] = after
          }
          return next
        },
        async applyLinks(value, loader) {
          const record = value ?? initialValue()
          await Promise.all(
            locales.map(locale =>
              Field.applyLinks(field, record[locale], loader)
            )
          )
        },
        searchableText(value) {
          const record = value ?? initialValue()
          return locales
            .map(locale => Field.searchableText(field, record[locale]))
            .join('')
        },
        references(value, context) {
          const record = value ?? initialValue()
          return locales.flatMap(locale =>
            Field.references(field, record[locale], {
              ...context,
              path: [...context.path, locale]
            })
          )
        },
        anchors(value, context) {
          const record = value ?? initialValue()
          return locales.flatMap(locale =>
            Field.anchors(field, record[locale], {
              ...context,
              path: [...context.path, locale]
            })
          )
        },
        normalizeAnchors(value, context) {
          // Leave a missing value missing, anchors only live in stored values
          if (value === undefined || value === null) return value
          const record = value
          let next = record
          for (const locale of locales) {
            const before = record[locale]
            const after = Field.normalizeAnchors(field, before, context)
            if (after === before) continue
            if (next === record) next = {...record}
            next[locale] = after
          }
          return next
        },
        isEmpty(value) {
          if (value === undefined || value === null) return true
          return locales.every(locale => Field.isEmpty(field, value[locale]))
        },
        valueErrors(value, options, context) {
          // Each locale is edited in its own tab and has to be valid by
          // itself, eg. a required field needs a value in every locale
          const record = (value ?? {}) as Partial<
            LocalisedValue<Locale, StoredValue>
          >
          return locales.flatMap(locale => {
            const path = [...context.path, locale]
            const labels = [...context.labels, locale.toUpperCase()]
            const localeValue = record[locale]
            const message = fieldError(field, options, localeValue)
            return [
              ...(message ? [{path, labels, message}] : []),
              ...Field.nestedErrors(field, localeValue, {
                ...context,
                path,
                labels
              })
            ]
          })
        },
        async queryValue(value, loader) {
          const selected = selectLocalisedValue<Locale, StoredValue>({
            value: value ?? initialValue(),
            locale: loader.locale,
            locales,
            fallback,
            defaultValue: Field.initialValue(field) as StoredValue
          })
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

export function selectLocalisedValue<Locale extends string, Value>({
  value,
  locale,
  locales,
  fallback,
  defaultValue
}: SelectLocalisedValueOptions<Locale, Value>): Value {
  const localisedValue = value as Partial<LocalisedValue<Locale, Value>>
  const requested = selectLocale(locale, locales)
  const directValue = localisedValue[requested]
  if (isAvailable(directValue)) return directValue as Value
  const fallbacks = fallback?.(requested) ?? []
  for (const fallbackLocale of fallbacks) {
    const fallbackValue = localisedValue[fallbackLocale]
    if (isAvailable(fallbackValue)) return fallbackValue as Value
  }
  return directValue === undefined && defaultValue !== undefined
    ? defaultValue
    : (directValue as Value)
}

function isAvailable<Value>(value: Value | undefined): value is Value {
  return value !== undefined && value !== null && value !== ''
}

/**
 * Holds a value of `field` per locale. With `locales` the value always has
 * those locales. Without, it uses the locales of the root of its entry: in a
 * root that translates fields (`i18n: {translate: 'fields'}`) it holds a
 * value per locale, in a root without `i18n` the plain value. Roots that
 * translate entries throw, their entries are a translation already.
 */
export function localised<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): LocalisedField<string, StoredValue, QueryValue, Options>
export function localised<
  const Locale extends string,
  StoredValue,
  QueryValue,
  Mutator,
  Options
>(
  field: Field<StoredValue, QueryValue, Mutator, Options>,
  options: LocaliserOptions<Locale>
): LocalisedField<Locale, StoredValue, QueryValue, Options>
export function localised<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>,
  options?: LocaliserOptions<string>
): LocalisedField<string, StoredValue, QueryValue, Options> {
  return options ? localiser(options)(field) : rootLocalised(field)
}

/** Whether a field takes its locales from the root of its entry */
export function inheritsLocales(field: Field): boolean {
  return field instanceof LocalisedField && !field.localisation.locales
}

type StoredLocales<Value> = Array<[locale: string | undefined, value: Value]>

/**
 * The values of a field that uses the locales of its root: a value per
 * locale, or the plain value in a root without i18n. The inner value is never
 * a record, see `Config.validate`, so a record is a value per locale.
 */
function storedLocales<Value>(value: unknown): StoredLocales<Value> {
  if (isRecord(value)) return entries(value) as StoredLocales<Value>
  if (value === undefined || value === null) return []
  return [[undefined, value as Value]]
}

function rootLocalised<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): LocalisedField<string, StoredValue, QueryValue, Options> {
  const data = getField(field)
  type Stored = LocalisedValue<string, StoredValue>
  return new LocalisedField<string, StoredValue, QueryValue, Options>(
    {
      referencedViews:
        typeof data.view === 'string'
          ? [data.view, ...(data.referencedViews ?? [])]
          : data.referencedViews,
      view: viewKeys.LocalisedInput,
      options: {...data.options, initialValue: undefined} as Omit<
        Options,
        'initialValue' | 'validate'
      > &
        FieldOptions<Stored>,
      withInitialValue(value, context) {
        const locales = context?.fieldI18n?.locales
        if (!locales) {
          if (!isRecord(value))
            return Field.withInitialValue(field, value as StoredValue) as Stored
          // Without the root the stored locales get their defaults
          let next = value as Record<string, StoredValue>
          for (const [locale, before] of entries(next)) {
            const after = Field.withInitialValue(field, before)
            if (after === before) continue
            if (next === value) next = {...next}
            next[locale] = after
          }
          return next as Stored
        }
        // A plain value, stored before the root translated fields, holds for
        // every locale
        const record: Record<string, StoredValue> = isRecord(value)
          ? {...(value as Record<string, StoredValue>)}
          : value === undefined || value === null
            ? {}
            : fromEntries(locales.map(locale => [locale, value as StoredValue]))
        for (const locale of locales)
          record[locale] = Field.withInitialValue(
            field,
            record[locale] ?? (Field.initialValue(field) as StoredValue)
          )
        return record as Stored
      },
      async applyLinks(value, loader) {
        await Promise.all(
          storedLocales<StoredValue>(value).map(([, inner]) =>
            Field.applyLinks(field, inner, loader)
          )
        )
      },
      searchableText(value) {
        return storedLocales<StoredValue>(value)
          .map(([, inner]) => Field.searchableText(field, inner))
          .join('')
      },
      references(value, context) {
        return storedLocales<StoredValue>(value).flatMap(([locale, inner]) =>
          Field.references(field, inner, {
            ...context,
            path: locale ? [...context.path, locale] : context.path
          })
        )
      },
      anchors(value, context) {
        return storedLocales<StoredValue>(value).flatMap(([locale, inner]) =>
          Field.anchors(field, inner, {
            ...context,
            path: locale ? [...context.path, locale] : context.path
          })
        )
      },
      normalizeAnchors(value, context) {
        if (!isRecord(value))
          return Field.normalizeAnchors(
            field,
            value as StoredValue,
            context
          ) as Stored
        let next = value
        for (const [locale, before] of entries(value)) {
          const after = Field.normalizeAnchors(field, before, context)
          if (after === before) continue
          if (next === value) next = {...value}
          next[locale] = after
        }
        return next
      },
      isEmpty(value) {
        return storedLocales<StoredValue>(value).every(([, inner]) =>
          Field.isEmpty(field, inner)
        )
      },
      valueErrors(value, options, context) {
        const locales = context.fieldI18n?.locales
        const values: StoredLocales<StoredValue> = locales
          ? locales.map(locale => [
              locale,
              isRecord(value)
                ? (value as Record<string, StoredValue>)[locale]
                : (value as StoredValue)
            ])
          : storedLocales<StoredValue>(value)
        if (values.length === 0) values.push([undefined, value as StoredValue])
        return values.flatMap(([locale, inner]) => {
          const path = locale ? [...context.path, locale] : context.path
          const labels = locale
            ? [...context.labels, locale.toUpperCase()]
            : context.labels
          const message = fieldError(field, options, inner)
          return [
            ...(message ? [{path, labels, message}] : []),
            ...Field.nestedErrors(field, inner, {...context, path, labels})
          ]
        })
      },
      async queryValue(value, loader) {
        const selected = isRecord(value)
          ? selectLocalisedValue({
              value: value as Stored,
              locale: loader.locale,
              locales: loader.fieldI18n?.locales ?? keys(value),
              fallback: loader.fieldI18n?.fallback,
              defaultValue: Field.initialValue(field) as StoredValue
            })
          : ((value ?? Field.initialValue(field)) as StoredValue)
        return Field.queryValue(field, selected, loader)
      }
    },
    {
      inner: field as Field<
        StoredValue,
        unknown,
        unknown,
        FieldOptions<StoredValue>
      >
    }
  )
}
