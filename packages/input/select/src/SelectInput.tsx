import {renderLabel} from '@alinea/core'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, px} from '@alinea/ui'
import {IcRoundArrowDropDownCircle} from '@alinea/ui/icons/IcRoundArrowDropDownCircle'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
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
        icon={IcRoundArrowDropDownCircle}
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
                  {renderLabel(label)}
                </option>
              )
            })}
          </select>
          <div className={styles.root.icon()}>
            <IcRoundKeyboardArrowDown style={{fontSize: px(18)}} />
          </div>
        </HStack>
      </InputLabel>
    </div>
  )
}
