import styler from '@alinea/styler'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {useEffect, useRef} from 'react'
import {NumberField} from './NumberField.js'
import css from './NumberField.module.scss'

const styles = styler(css)

export interface NumberInputProps {
  field: NumberField
}

function tryParseNumber(input: string) {
  const value = parseFloat(input)
  return isNaN(value) ? null : value
}

export function NumberInput({field}: NumberInputProps) {
  const {options, value, mutator, error} = useField(field)
  const {minValue, maxValue, readOnly, step} = options
  const ref = useRef<HTMLInputElement>(null)
  const defaultValue = String(value ?? '')
  useEffect(() => {
    const input = ref.current
    if (!input) return
    const currentInput = tryParseNumber(input.value)
    if (currentInput === value) return
    // facebook/react#25384
    input.value = defaultValue
  }, [defaultValue])
  return (
    <InputLabel asLabel {...options} error={error} icon={IcRoundNumbers}>
      <input
        type="number"
        ref={ref}
        className={styles.root.input()}
        defaultValue={defaultValue}
        onChange={({currentTarget}) => {
          const newValue = tryParseNumber(currentTarget.value)
          if (newValue !== value) mutator(newValue)
        }}
        onBlur={({currentTarget}) => {
          const newValue = tryParseNumber(currentTarget.value)
          if (newValue !== value) mutator(newValue)
          currentTarget.value = String(newValue ?? '')
        }}
        min={minValue}
        max={maxValue}
        readOnly={readOnly}
        step={step || 1}
      />
    </InputLabel>
  )
}
