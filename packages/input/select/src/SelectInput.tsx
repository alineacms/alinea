import {InputLabel, InputState, useInput} from '@alineacms/editor'
import {fromModule, HStack} from '@alineacms/ui'
import {MdArrowDropDownCircle, MdKeyboardArrowDown} from 'react-icons/md'
import {SelectField} from './SelectField'
import css from './SelectInput.module.scss'

const styles = fromModule(css)

export type SelectInputProps = {
  state: InputState<InputState.Scalar<string | undefined>>
  field: SelectField
}

export function SelectInput({state, field}: SelectInputProps) {
  const [value, setValue] = useInput(state)
  const {optional, help} = field.options
  const {items} = field
  return (
    <div>
      <InputLabel
        asLabel
        label={field.label}
        help={help}
        optional={optional}
        icon={MdArrowDropDownCircle}
      >
        <HStack center className={styles.root()}>
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className={styles.root.input()}
          >
            {Object.entries(items).map(([key, label]) => {
              return (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            })}
          </select>
          <div className={styles.root.icon()}>
            <MdKeyboardArrowDown size={18} />
          </div>
        </HStack>
      </InputLabel>
    </div>
  )
}
