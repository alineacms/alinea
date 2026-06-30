import {Label} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/store.js'
import {CodeField} from '#/field/code.js'
import {styler} from '@alinea/styler'
import lolight from 'lolight'
import {Fragment, ReactNode, useId} from 'react'
import css from './CodeField.module.css'
import {SimpleCodeEditor} from './SimpleCodeEditor.js'

const styles = styler(css)

const tokenClassNames: Record<string, string> = {
  com: styles.CodeEditorInput.comment(),
  key: styles.CodeEditorInput.keyword(),
  nam: styles.CodeEditorInput.identifier(),
  num: styles.CodeEditorInput.number(),
  pct: styles.CodeEditorInput.punctuation(),
  rex: styles.CodeEditorInput.regex(),
  str: styles.CodeEditorInput.string()
}

export interface CodeFieldViewProps {
  field: CodeField
}

export interface CodeEditorInputProps {
  autoFocus?: boolean
  description?: ReactNode
  errorMessage?: ReactNode
  highlight?: (value: string) => ReactNode
  invalid?: boolean
  isRequired?: boolean
  label?: ReactNode
  shared?: boolean
  onValueChange: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  placeholder?: string
  readOnly?: boolean
  value: string
}

function renderHighlightedCode(value: string) {
  return lolight.tok(value).map(([type, token], index) => {
    const className = tokenClassNames[type]
    if (!className) return <Fragment key={index}>{token}</Fragment>
    return (
      <span key={index} className={className}>
        {token}
      </span>
    )
  })
}

export function CodeEditorInput({
  autoFocus,
  description,
  errorMessage,
  highlight = renderHighlightedCode,
  invalid = false,
  isRequired,
  label,
  shared,
  onBlur,
  onFocus,
  onValueChange,
  placeholder,
  readOnly,
  value
}: CodeEditorInputProps) {
  const inputId = useId()
  return (
    <Label
      htmlFor={inputId}
      label={label}
      description={description}
      errorMessage={errorMessage}
      isRequired={isRequired}
      shared={shared}
    >
      <div
        className={styles.CodeEditorInput()}
        data-invalid={invalid || undefined}
        data-read-only={readOnly || undefined}
      >
        <SimpleCodeEditor
          autoFocus={autoFocus}
          className={styles.CodeEditorInput.editor()}
          disabled={readOnly}
          highlight={highlight}
          onBlur={onBlur}
          onFocus={onFocus}
          onValueChange={onValueChange}
          padding={{top: 8, right: 10, bottom: 8, left: 10}}
          placeholder={placeholder}
          preClassName={styles.CodeEditorInput.pre()}
          readOnly={readOnly}
          tabSize={2}
          textareaClassName={styles.CodeEditorInput.textarea()}
          textareaId={inputId}
          value={value}
        />
      </div>
    </Label>
  )
}

export function CodeFieldView({field}: CodeFieldViewProps) {
  const [value = '', setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <CodeEditorInput
      description={options.help}
      errorMessage={error}
      isRequired={options.required}
      label={options.label}
      shared={options.shared}
      onValueChange={setValue}
      placeholder={options.inline ? String(options.label) : undefined}
      readOnly={options.readOnly}
      value={value}
    />
  )
}
