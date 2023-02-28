import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating
} from '@floating-ui/react-dom'
import {Listbox} from '@headlessui/react'
import {Field, Label} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule, HStack, Icon, IconButton, TextLabel} from 'alinea/ui'
import {IcRoundArrowDropDownCircle} from 'alinea/ui/icons/IcRoundArrowDropDownCircle'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {select as createSelect, SelectField} from './SelectField.js'
import css from './SelectInput.module.scss'

export * from './SelectField.js'

export const select = Field.withView(createSelect, SelectInput)

const styles = fromModule(css)

type SelectInputProps<T extends string> = {
  state: InputState<InputState.Scalar<T>>
  field: SelectField<T>
}

function SelectInput<T extends string>({state, field}: SelectInputProps<T>) {
  const {width, optional, help, placeholder, inline, initialValue, readonly} =
    field.options
  const [value = initialValue, setValue] = useInput(state)
  const items = field.items as Record<string, Label>
  const {x, y, reference, floating, refs, strategy} = useFloating({
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip(),
      size({
        apply({rects}) {
          if (refs.floating.current)
            Object.assign(refs.floating.current.style, {
              width: `${rects.reference.width}px`
            })
        }
      })
    ]
  })

  return (
    <InputLabel
      label={field.label}
      help={help}
      optional={optional}
      inline={inline}
      width={width}
      icon={IcRoundArrowDropDownCircle}
    >
      <div className={styles.root()}>
        <Listbox value={value} onChange={setValue} disabled={readonly}>
          {({open}) => (
            <div>
              <Listbox.Button
                ref={reference}
                className={styles.root.input({open})}
              >
                <span
                  className={styles.root.input.label({placeholder: !value})}
                >
                  <TextLabel
                    label={(value ? items[value] : placeholder) || field.label}
                  />
                </span>
                <Icon
                  icon={IcRoundUnfoldMore}
                  className={styles.root.input.icon()}
                />
                {value && optional && (
                  <IconButton
                    icon={IcRoundClose}
                    onClick={() => setValue(undefined!)}
                    className={styles.root.input.delete()}
                  />
                )}
              </Listbox.Button>
              <Listbox.Options
                ref={floating}
                style={{
                  position: strategy,
                  top: `${y || 0}px`,
                  left: `${x || 0}px`
                }}
                className={styles.root.dropdown()}
              >
                <div className={styles.root.dropdown.inner()}>
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
                          <TextLabel label={label} />
                          <div className={styles.root.dropdown.option.icon()}>
                            {selected && <Icon size={18} icon={IcRoundCheck} />}
                          </div>
                        </HStack>
                      )}
                    </Listbox.Option>
                  ))}
                </div>
              </Listbox.Options>
            </div>
          )}
        </Listbox>
      </div>
    </InputLabel>
  )
}
