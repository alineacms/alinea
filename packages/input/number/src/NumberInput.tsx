import {InputLabel, InputState} from '@alineacms/editor'
import {fromModule} from '@alineacms/ui'
import {NumberField} from './NumberField'
import css from './NumberInput.module.scss'

const styles = fromModule(css)

export type NumberInputProps = {
  state: InputState<InputState.Scalar<number>>
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
