import styler from '@alinea/styler'
import {useField} from 'alinea/dashboard/editor/UseField'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, Icon, TextLabel} from 'alinea/ui'
import {IcRoundArrowDropDownCircle} from 'alinea/ui/icons/IcRoundArrowDropDownCircle'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select
} from 'react-aria-components'
import {SelectField} from './SelectField.js'
import css from './SelectField.module.scss'

const styles = styler(css)

export interface SelectInputProps<Key extends string> {
  field: SelectField<Key>
}

export function SelectInput<Key extends string>({
  field
}: SelectInputProps<Key>) {
  const {value = null, mutator, label, options, error} = useField(field)
  const {readOnly} = options
  const items = options.options as Record<string, string>
  return (
    <InputLabel {...options} icon={IcRoundArrowDropDownCircle}>
      <div className={styles.root()}>
        <Select
          aria-label={options.label}
          selectedKey={value}
          onSelectionChange={value => {
            mutator(value as Key)
          }}
          isDisabled={options.readOnly}
        >
          <div>
            <div className={styles.root.input.button()}>
              <Button className={styles.root.input()}>
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
              </Button>
              {value && (
                <IconButton
                  icon={IcRoundClose}
                  onClick={() => mutator(undefined!)}
                  className={styles.root.input.delete()}
                />
              )}
            </div>
            <Popover className={styles.root.dropdown()}>
              <ListBox className={styles.root.dropdown.inner()}>
                {Object.entries(items).map(([key, label]) => {
                  const isSelected = key === value
                  return (
                    <ListBoxItem key={key} id={key} textValue={label}>
                      <HStack
                        center
                        gap={4}
                        className={styles.root.dropdown.option()}
                      >
                        <TextLabel label={label} />
                        <div className={styles.root.dropdown.option.icon()}>
                          {isSelected && <Icon size={18} icon={IcRoundCheck} />}
                        </div>
                      </HStack>
                    </ListBoxItem>
                  )
                })}
              </ListBox>
            </Popover>
          </div>
        </Select>
      </div>
    </InputLabel>
  )
}
