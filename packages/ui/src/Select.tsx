import {DropdownMenu} from './DropdownMenu'
import {Icon} from './Icon'
import IcRoundArrowDropDown from './icons/IcRoundArrowDropDown'
import {IcRoundCheck} from './icons/IcRoundCheck'
import css from './Select.module.scss'
import {fromModule} from './util/Styler'
const styles = fromModule(css)

export type SelectedOption = {key: string; label: string}

const Select: React.FC<{
  handleOnChange: (option: string | null) => void
  options: Array<SelectedOption>
  selectedKey?: string
  trigger?: string
  optional?: boolean
}> = ({
  handleOnChange,
  options,
  selectedKey,
  trigger = 'Select',
  optional = false
}) => {
  return (
    <div className={styles.select()}>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger>
          {(selectedKey &&
            options.find(option => option.key === selectedKey)?.label) ||
            trigger}{' '}
          <span className={styles.select.button.icon()}>
            <Icon icon={IcRoundArrowDropDown} />
          </span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" sideOffset={5}>
          <DropdownMenu.RadioGroup
            value={selectedKey}
            onValueChange={(value: string) => {
              if (optional && value === selectedKey) {
                return handleOnChange(null)
              }
              return handleOnChange(value)
            }}
          >
            {options.map(option => (
              <DropdownMenu.RadioItem value={option.key} key={option.key}>
                <DropdownMenu.ItemIndicator>
                  <Icon icon={IcRoundCheck} />
                </DropdownMenu.ItemIndicator>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  )
}
export default Select
