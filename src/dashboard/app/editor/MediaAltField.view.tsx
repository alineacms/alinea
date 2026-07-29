import {TextField} from '#/components.js'
import type {
  MediaAltField,
  MediaAltOptions,
  MediaAltValue
} from '#/core/media/MediaAltField.js'
import {assert} from '#/core/util/Assert.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {routeAtom} from '../../atoms/routing/index.js'
import {workspaceAtoms} from '../../atoms/workspace.js'
import {isRecord} from '#/core/util/Objects.js'
import {LocalisedFieldTabs} from '#/field/localiser/LocalisedFieldTabs.js'
import {useAtomValue} from 'jotai'
import {useState} from 'react'

export interface MediaAltFieldViewProps {
  field: MediaAltField
}

export function MediaAltFieldView({field}: MediaAltFieldViewProps) {
  const route = useAtomValue(routeAtom)
  assert(route.workspace, 'Media alt field requires an active workspace')
  assert(route.root, 'Media alt field requires an active root')
  const i18n = useAtomValue(
    workspaceAtoms(route.workspace).root(route.root).mediaI18n
  )
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const [locale, setLocale] = useState(i18n?.locales[0])

  if (!i18n) {
    return (
      <MediaAltTextField
        error={error}
        options={options}
        value={mediaAltString(value)}
        onChange={next => setValue(next)}
      />
    )
  }

  const selectedLocale = locale ?? i18n.locales[0]
  return (
    <LocalisedFieldTabs
      locales={i18n.locales}
      selectedLocale={selectedLocale}
      onSelectedLocaleChange={setLocale}
    >
      {locale => (
        <MediaAltTextField
          error={error}
          options={options}
          value={mediaAltString(value, locale)}
          onChange={next => {
            setValue(current => mediaAltLocalise(current, locale, next))
          }}
        />
      )}
    </LocalisedFieldTabs>
  )
}

interface MediaAltTextFieldProps {
  error: string | undefined
  options: MediaAltOptions
  value: string
  onChange(value: string): void
}

function MediaAltTextField({
  error,
  options,
  value,
  onChange
}: MediaAltTextFieldProps) {
  return (
    <TextField
      description={options.help}
      errorMessage={error}
      isDisabled={options.readOnly}
      isRequired={options.required}
      label={options.inline ? undefined : options.label}
      multiline={options.multiline}
      placeholder={
        options.placeholder ?? (options.inline ? options.label : undefined)
      }
      shared={options.shared}
      type={options.type}
      value={value}
      onChange={onChange}
    />
  )
}

function mediaAltString(value: MediaAltValue, locale?: string): string {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return ''
  if (locale && typeof value[locale] === 'string') return value[locale]
  return Object.values(value).find(value => typeof value === 'string') ?? ''
}

function mediaAltLocalise(
  value: MediaAltValue,
  locale: string,
  next: string
): Record<string, string> {
  const current = isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
      )
    : {}
  if (typeof value === 'string') current[locale] = value
  return {...current, [locale]: next}
}
