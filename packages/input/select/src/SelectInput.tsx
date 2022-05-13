import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, Icon, TextLabel} from '@alinea/ui'
import {IcRoundArrowDropDownCircle} from '@alinea/ui/icons/IcRoundArrowDropDownCircle'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {Listbox} from '@headlessui/react'
import {SelectField} from './SelectField'
import css from './SelectInput.module.scss'

const styles = fromModule(css)

export type SelectInputProps = {
  state: InputState<InputState.Scalar<string | undefined>>
  field: SelectField
}

export function SelectInput({state, field}: SelectInputProps) {
  const {optional, help, initialValue} = field.options
  const [value = initialValue, setValue] = useInput(state)
  const {items} = field

  return (
    <div>
      <InputLabel
        label={field.label}
        help={help}
        optional={optional}
        icon={IcRoundArrowDropDownCircle}
      >
        <div className={styles.root()}>
          <Listbox value={value} onChange={setValue}>
            {({open}) => (
              <>
                <Listbox.Button className={styles.root.input({open})}>
                  <span className={styles.root.input.label()}>
                    <TextLabel label={value ? items[value] : field.label} />
                  </span>
                  <Icon
                    icon={IcRoundUnfoldMore}
                    className={styles.root.input.icon()}
                  />
                </Listbox.Button>
                <Listbox.Options className={styles.root.dropdown()}>
                  {Object.entries(items).map(([key, label]) => (
                    <Listbox.Option key={key} value={key}>
                      {({active, selected}) => (
                        <HStack
                          center
                          gap={4}
                          className={styles.root.dropdown.option({active})}
                        >
                          <div className={styles.root.dropdown.option.icon()}>
                            {selected && <Icon size={18} icon={IcRoundCheck} />}
                          </div>
                          <TextLabel label={label} />
                        </HStack>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </>
            )}
          </Listbox>
        </div>
      </InputLabel>
    </div>
  )
}
