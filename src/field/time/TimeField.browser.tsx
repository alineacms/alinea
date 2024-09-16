import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule} from 'alinea/ui'
import {IcRoundDateRange} from 'alinea/ui/icons/IcRoundDateRange'
import {TimeField, time as createTime} from './TimeField.js'
import css from './TimeField.module.scss'

export * from './TimeField.js'

export const time = Field.provideView(TimeInput, createTime)

const styles = fromModule(css)

interface TimeInputProps {
  field: TimeField
}

function TimeInput({field}: TimeInputProps) {
  const {options, value, mutator, error} = useField(field)
  const {minValue, maxValue, readOnly, step, autoFocus} = options
  return (
    <InputLabel asLabel {...options} error={error} icon={IcRoundDateRange}>
      <input
        className={styles.root.input()}
        type="time"
        value={value ?? ''}
        onChange={e => mutator(e.currentTarget.value)}
        autoFocus={autoFocus}
        readOnly={readOnly}
        min={minValue}
        max={maxValue}
        step={step || 60}
      />
    </InputLabel>
  )
}
