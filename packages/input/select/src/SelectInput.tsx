import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {MdArrowDropDownCircle} from 'react-icons/md'
import {SelectField} from './SelectField'
import css from './SelectInput.module.scss'

const styles = fromModule(css)

export type SelectInputProps = {
  state: InputState<string | undefined>
  field: SelectField
}

export function SelectInput({state, field}: SelectInputProps) {
  const [value, setValue] = useInput(state)
  const {optional, help} = field.options
  const {items} = field
  return (
    <div className={styles.root()}>
      <InputLabel
        label={field.label}
        help={help}
        optional={optional}
        icon={MdArrowDropDownCircle}
      >
        <select value={value} onChange={e => setValue(e.target.value)}>
          {Object.entries(items).map(([key, label]) => {
            return (
              <option key={key} value={key}>
                {label}
              </option>
            )
          })}
        </select>
      </InputLabel>
    </div>
  )
}
