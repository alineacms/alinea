import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {NumberField, number as createNumber} from './NumberField.js'
import css from './NumberInput.module.scss'

export * from './NumberField.js'

export const number = Field.provideView(NumberInput, createNumber)

const styles = fromModule(css)

interface NumberInputProps {
  field: NumberField
}

function NumberInput({field}: NumberInputProps) {
  const {options, value, mutator, label} = useField(field)
  const {minValue, maxValue, readOnly, step} = options
  return (
    <InputLabel asLabel label={label} {...options} icon={IcRoundNumbers}>
      <input
        type="number"
        className={styles.root.input()}
        value={String(value ?? '')}
        onBlur={e =>
          mutator(
            e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
          )
        }
        min={minValue}
        max={maxValue}
        disabled={readOnly}
        step={step || 1}
      />
    </InputLabel>
  )
}
