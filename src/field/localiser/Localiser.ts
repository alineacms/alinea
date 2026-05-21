import type {LinkResolver} from '#/core/db/LinkResolver.js'
import type {FieldOptions} from '#/core/Field.js'
import {Field} from '#/core/Field.js'
import {getField} from '#/core/Internal.js'
import {Root, type RootI18n} from '#/core/Root.js'
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

export interface SelectLinkedLocalisedValueOptions<Value> {
  value: LocalisedValue<string, Value> | Value
  loader: LinkResolver
  workspace: string
  root: string
  defaultValue?: Value
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
    const innerShape = data.shape as Shape<StoredValue>
    const shape = new LocalisedShape<Locale, StoredValue>(
      data.shape.label,
      locales,
      innerShape
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
          const selected = selectLocalisedValue<Locale, StoredValue>({
            value: value ?? shape.create(),
            locale: loader.locale,
            locales,
            fallback,
            defaultValue: innerShape.create()
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

export function selectLinkedLocalisedValue<Value>({
  value,
  loader,
  workspace,
  root,
  defaultValue
}: SelectLinkedLocalisedValueOptions<Value>): Value | LocalisedValue<string, Value> {
  if (!isRecord(value)) return value
  const localisation = linkedLocalisation(loader, workspace, root)
  if (!localisation) return value
  return selectLocalisedValue({
    value: value as LocalisedValue<string, Value>,
    locale: loader.locale,
    locales: localisation.locales,
    fallback: localisation.fallback,
    defaultValue
  })
}

function linkedLocalisation(
  loader: LinkResolver,
  workspaceName: string,
  rootName: string
): LocaliserOptions | undefined {
  const workspace = loader.resolver.config.workspaces[workspaceName]
  const root = workspace?.[rootName]
  if (!root) return
  const rootData = Root.data(root)
  const mediaI18n = (rootData as {_media?: {i18n?: RootI18n}})._media?.i18n
  return mediaI18n ?? rootData.i18n
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
