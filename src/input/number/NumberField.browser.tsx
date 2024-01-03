import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule} from 'alinea/ui'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {useState} from 'react'
import {NumberField, number as createNumber} from './NumberField.js'
import css from './NumberInput.module.scss'

export * from './NumberField.js'

export const number = Field.provideView(NumberInput, createNumber)

const styles = fromModule(css)

interface NumberInputProps {
  field: NumberField
}

function NumberInput({field}: NumberInputProps) {
  const {options, value, mutator} = useField(field)
  const [current, setCurrent] = useState(String(value ?? ''))
  const {minValue, maxValue, readOnly, step} = options
  return (
    <InputLabel asLabel {...options} icon={IcRoundNumbers}>
      <input
        type="number"
        className={styles.root.input()}
        value={current}
        onChange={e => {
          setCurrent(e.currentTarget.value)
        }}
        onBlur={() => {
          const newValue = current ? parseFloat(current) : null
          mutator(newValue)
          setCurrent(String(newValue ?? ''))
        }}
        min={minValue}
        max={maxValue}
        disabled={readOnly}
        step={step || 1}
      />
    </InputLabel>
  )
}
