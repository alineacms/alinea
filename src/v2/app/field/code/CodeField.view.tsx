import {Elevation, Label} from '@alinea/components'
import {styler} from '@alinea/styler'
import {CodeField} from 'alinea/field/code'
import lolight from 'lolight'
import {Fragment, useId} from 'react'
import CodeEditor from 'react-simple-code-editor/src/index.js'
import {useFieldError, useFieldOptions, useFieldValue} from '../../../store.js'
import css from './CodeField.module.css'

const styles = styler(css)

const tokenClassNames: Record<string, string> = {
  com: styles.comment(),
  key: styles.keyword(),
  nam: styles.identifier(),
  num: styles.number(),
  pct: styles.punctuation(),
  rex: styles.regex(),
  str: styles.string()
}

export interface CodeFieldViewProps {
  field: CodeField
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

export function CodeFieldView({field}: CodeFieldViewProps) {
  const [value = '', setValue] = useFieldValue(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const inputId = useId()
  return (
    <Label
      label={options.label}
      description={options.help}
      errorMessage={error}
      isRequired={options.required}
    >
      <Elevation className={styles.root()}>
        <CodeEditor
          className={styles.editor()}
          disabled={options.readOnly}
          highlight={renderHighlightedCode}
          onValueChange={setValue}
          padding={14}
          placeholder={options.inline ? String(options.label) : undefined}
          preClassName={styles.pre()}
          readOnly={options.readOnly}
          tabSize={2}
          textareaClassName={styles.textarea()}
          textareaId={inputId}
          value={value}
        />
      </Elevation>
    </Label>
  )
}
