import {InputPath} from '@alinea/core'
import {Label, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import TextareaAutosize from 'react-autosize-textarea'
import {TextField} from './TextField'
import css from './TextInput.module.scss'

const styles = fromModule(css)

export type TextInputProps = {
  path: InputPath<string>
  field: TextField
}

export function TextInput({path, field}: TextInputProps) {
  const [value, setValue] = useInput(path)
  const {multiline, optional, help} = field.options
  const Input = multiline ? TextareaAutosize : 'input'
  return (
    <div className={styles.root()}>
      <Label label={field.label} help={help} optional={optional}>
        <Input
          className={styles.root.input()}
          type="text"
          value={value || ''}
          onChange={e => setValue(e.currentTarget.value)}
        />
      </Label>
    </div>
  )
}
