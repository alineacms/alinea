import {InputLabel} from '@alinea/editor/InputLabel'
import {TextField} from './TextField'

export type TextInputProps = {
  field: TextField
}

export function TextInput({field}: TextInputProps) {
  return (
    <div>
      <InputLabel label={field.label}>
        <input type="text" />
      </InputLabel>
    </div>
  )
}
