import {InputPath} from '@alinea/core'
import {InputLabel, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui/styler'
import {TextField} from './TextField'
import css from './TextInput.module.scss'

const styles = fromModule(css)

export type TextInputProps = {
  path: InputPath<string>
  field: TextField
}

export function TextInput({field, path}: TextInputProps) {
  const input = useInput(path)
  return (
    <div>
      <InputLabel label={field.label}>
        <input
          type="text"
          value={input.value}
          onChange={e => input.setValue(e.target.value)}
        />
      </InputLabel>
    </div>
  )
}
