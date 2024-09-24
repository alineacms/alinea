import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating
} from '@floating-ui/react-dom'
import {Listbox} from '@headlessui/react'
import {useField} from 'alinea/dashboard/editor/UseField'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, Icon, TextLabel, fromModule} from 'alinea/ui'
import {IcRoundArrowDropDownCircle} from 'alinea/ui/icons/IcRoundArrowDropDownCircle'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {SelectField} from './SelectField.js'
import css from './SelectField.module.scss'

const styles = fromModule(css)

export interface SelectInputProps<Key extends string> {
  field: SelectField<Key>
}

export function SelectInput<Key extends string>({
  field
}: SelectInputProps<Key>) {
  const {value = null, mutator, label, options, error} = useField(field)
  const {readOnly} = options
  const items = options.options as Record<string, string>
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
    <InputLabel {...options} error={error} icon={IcRoundArrowDropDownCircle}>
      <div className={styles.root({readOnly})}>
        <Listbox value={value} onChange={mutator} disabled={options.readOnly}>
          {({open}) => (
            <div>
              <div className={styles.root.input({open})}>
                <Listbox.Button
                  ref={reference}
                  className={styles.root.input.button()}
                >
                  <span
                    className={styles.root.input.label({placeholder: !value})}
                  >
                    <TextLabel
                      label={
                        (value ? items[value] : options.placeholder) || label
                      }
                    />
                  </span>
                  <Icon
                    icon={IcRoundUnfoldMore}
                    className={styles.root.input.icon()}
                  />
                </Listbox.Button>
                {value && !options.required && (
                  <IconButton
                    icon={IcRoundClose}
                    onClick={() => mutator(undefined!)}
                    className={styles.root.input.delete()}
                  />
                )}
              </div>
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
