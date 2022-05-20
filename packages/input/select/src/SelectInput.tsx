import {Label} from '@alinea/core'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, Icon, TextLabel} from '@alinea/ui'
import {IcRoundArrowDropDownCircle} from '@alinea/ui/icons/IcRoundArrowDropDownCircle'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {size} from '@floating-ui/dom'
import {Listbox} from '@headlessui/react'
import {Float} from 'headlessui-float-react'
import {useRef} from 'react'
import {SelectField} from './SelectField'
import css from './SelectInput.module.scss'

const styles = fromModule(css)

export type SelectInputProps<T extends string> = {
  state: InputState<InputState.Scalar<T>>
  field: SelectField<T>
}

export function SelectInput<T extends string>({
  state,
  field
}: SelectInputProps<T>) {
  const {width, optional, help, placeholder, initialValue} = field.options
  const [value = initialValue, setValue] = useInput(state)
  const items = field.items as Record<string, Label>
  const box = useRef<HTMLDivElement>(null)
  const sameSize = [
    size({
      apply(rects) {
        if (box.current)
          Object.assign(box.current.style, {
            width: `${rects.reference.width}px`
          })
      }
    })
  ]
  return (
    <InputLabel
      width={width}
      label={field.label}
      help={help}
      optional={optional}
      icon={IcRoundArrowDropDownCircle}
    >
      <div className={styles.root()}>
        <Listbox value={value} onChange={setValue}>
          {({open}) => (
            <Float
              placement="bottom-start"
              flip
              offset={4}
              transform={false}
              middleware={sameSize}
            >
              <Listbox.Button className={styles.root.input({open})}>
                <span className={styles.root.input.label()}>
                  <TextLabel
                    label={value ? items[value] : placeholder || field.label}
                  />
                </span>
                <Icon
                  icon={IcRoundUnfoldMore}
                  className={styles.root.input.icon()}
                />
              </Listbox.Button>
              <Listbox.Options className={styles.root.dropdown()}>
                <div ref={box} className={styles.root.dropdown.inner()}>
                  {Object.entries(items).map(([key, label]) => (
                    <Listbox.Option key={key} value={key}>
                      {({active, selected}) => (
                        <HStack
                          center
                          gap={4}
                          className={styles.root.dropdown.option({
                            active,
                            selected
                          })}
                        >
                          <div className={styles.root.dropdown.option.icon()}>
                            {selected && <Icon size={18} icon={IcRoundCheck} />}
                          </div>
                          <TextLabel label={label} />
                        </HStack>
                      )}
                    </Listbox.Option>
                  ))}
                </div>
              </Listbox.Options>
            </Float>
          )}
        </Listbox>
      </div>
    </InputLabel>
  )
}
