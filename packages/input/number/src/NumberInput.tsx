import {InputLabel} from '@alinea/editor/InputLabel'
import {NumberField} from './NumberField'

export type NumberInputProps = {
  field: NumberField
}

export function NumberInput({field}: NumberInputProps) {
  return (
    <div>
      <InputLabel label={field.label}>
        <input type="number" />
      </InputLabel>
    </div>
  )
}
