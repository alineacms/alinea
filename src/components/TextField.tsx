import styler from '@alinea/styler'
import {
  Input,
  TextArea,
  TextField as TextFieldPrimitive,
  type TextFieldProps as TextFieldPrimitiveProps
} from 'react-aria-components'
import {Label, type LabelSharedProps, labelProps} from '../components/Label.js'
import css from './TextField.module.css'

const styles = styler(css)

export interface TextFieldProps
  extends LabelSharedProps, TextFieldPrimitiveProps {
  multiline?: boolean
  rows?: number
  placeholder?: string
  className?: string
}

export function TextField({
  multiline,
  rows,
  className,
  ...props
}: TextFieldProps) {
  const hasValue =
    (props.value ?? props.placeholder ?? props.defaultValue) !== undefined
  if (multiline && !hasValue)
    throw new Error('Multiline TextField requires a value or defaultValue')
  return (
    <TextFieldPrimitive {...props}>
      <Label {...labelProps(props)}>
        <div className={styles.TextField(styler.merge({className}))}>
          {multiline ? (
            <div className={styles.TextField.multiline()}>
              <TextArea
                className={styles.TextField.multiline.area()}
                rows={rows || 1}
              />
              <div
                aria-hidden="true"
                className={styles.TextField.multiline.shadow()}
              >
                {props.value || props.placeholder}
              </div>
            </div>
          ) : (
            <Input className={styles.TextField.input()} />
          )}
        </div>
      </Label>
    </TextFieldPrimitive>
  )
}
