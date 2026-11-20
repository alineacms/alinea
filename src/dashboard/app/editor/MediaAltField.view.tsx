import {TextField} from '#/components.js'
import {
  mediaAltLocalise,
  mediaAltText,
  type MediaAltField,
  type MediaAltOptions,
  type MediaAltValue
} from '#/core/media/MediaAltField.js'
import {
  useEntryAtoms,
  useField,
  useFieldError,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {LocalisedFieldTabs} from '#/field/localiser/LocalisedFieldTabs.js'
import {useAtomValueRaw} from 'jotai'
import {useState} from 'react'

export interface MediaAltFieldViewProps {
  field: MediaAltField
}

export function MediaAltFieldView({field}: MediaAltFieldViewProps) {
  const {entry} = useEntryAtoms()
  const i18n = useAtomValueRaw(entry.fieldI18n)
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
            setValue(current =>
              mediaAltLocalise(current, i18n.locales, locale, next)
            )
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
      error={error}
      disabled={options.readOnly}
      required={options.required}
      label={options.inline ? undefined : options.label}
      multiline={options.multiline}
      placeholder={
        options.placeholder ?? (options.inline ? options.label : undefined)
      }
      shared={options.shared}
      type={options.type}
      value={value}
      onValueChange={onChange}
    />
  )
}
