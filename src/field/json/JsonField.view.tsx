import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {JsonField} from '#/field/json.js'
import {useState} from 'react'
import {CodeEditorInput} from '../code/CodeField.view.js'

export interface JsonFieldViewProps<Value> {
  field: JsonField<Value>
}

function formatJsonValue(value: unknown): string {
  const formatted = JSON.stringify(value, null, 2)
  return formatted ?? ''
}

function parseJsonValue<Value>(text: string): Value | undefined {
  if (!text.trim()) return undefined
  return JSON.parse(text) as Value
}

export function JsonFieldView<Value>({field}: JsonFieldViewProps<Value>) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const [editingText, setEditingText] = useState<string>()
  const [parseError, setParseError] = useState<string | undefined>()
  const text = editingText ?? formatJsonValue(value)

  function handleValueChange(nextText: string) {
    setEditingText(nextText)
    try {
      const parsed = parseJsonValue<Value>(nextText)
      if (parsed === undefined) {
        setParseError(undefined)
        return
      }
      setValue(parsed)
      setParseError(undefined)
    } catch (parseFailure) {
      const message =
        parseFailure instanceof Error ? parseFailure.message : 'Invalid JSON'
      setParseError(message)
    }
  }

  function handleFocus() {
    setEditingText(text)
  }

  function handleBlur() {
    if (!parseError) setEditingText(undefined)
  }

  return (
    <CodeEditorInput
      autoFocus={options.autoFocus}
      description={options.help}
      errorMessage={parseError || error}
      invalid={Boolean(parseError)}
      isRequired={options.required}
      label={options.label}
      shared={options.shared}
      onValueChange={handleValueChange}
      placeholder={options.inline ? String(options.label) : undefined}
      readOnly={options.readOnly}
      value={text}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  )
}
