import {TextField} from '#/components.js'
import {
  mediaAltText,
  type MediaAltField,
  type MediaAltOptions,
  type MediaAltValue
} from '#/core/media/MediaAltField.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  useEntryAtoms,
  useField,
  useFieldError,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {LocalisedFieldTabs} from '#/field/localiser/LocalisedFieldTabs.js'
import {useAtomValue} from 'jotai'
import {useState} from 'react'

export interface MediaAltFieldViewProps {
  field: MediaAltField
}

export function MediaAltFieldView({field}: MediaAltFieldViewProps) {
  const {entry} = useEntryAtoms()
  const i18n = useAtomValue(entry.mediaI18n)
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const [locale, setLocale] = useState(i18n?.locales[0])

  if (!i18n) {
    return (
      <MediaAltTextField
        error={error}
        options={options}
        value={mediaAltText(value)}
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
          value={mediaAltText(value, locale)}
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
