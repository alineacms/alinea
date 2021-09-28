import {InputPath} from '@alinea/core'
import {Label} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {NumberField} from './NumberField'
import css from './NumberInput.module.scss'

const styles = fromModule(css)

export type NumberInputProps = {
  path: InputPath<number>
  field: NumberField
}

export function NumberInput({field}: NumberInputProps) {
  return (
    <div>
      <Label label={field.label}>
        <input type="number" />
      </Label>
    </div>
  )
}
