import styler from '@alinea/styler'
import type {ReactElement, ReactNode} from 'react'
import {ListBoxItem, Text} from 'react-aria-components'
import {IcRoundCheck} from '../../dashboard/icons.js'
import {Icon} from '../Icon.js'
import type {IconType} from '../types.js'
import css from './ListBoxOption.module.css'

const styles = styler(css)

export interface ListBoxOptionProps {
  /** Prefix for the data-slot attributes, eg. "select-item" */
  slot: string
  value: string
  textValue?: string
  disabled?: boolean
  icon?: IconType | ReactElement
  description?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * An option in the listbox of a Select, ComboBox or MultipleSelect. Renders
 * an optional icon, the label, an optional description and a check mark
 * when selected.
 */
export function ListBoxOption({
  slot,
  value,
  textValue,
  disabled,
  icon,
  description,
  className,
  children
}: ListBoxOptionProps) {
  const text =
    textValue ?? (typeof children === 'string' ? children : undefined)
  if (text === undefined)
    throw new Error(
      `Provide a textValue or a string child for the "${value}" option`
    )
  return (
    <ListBoxItem
      id={value}
      textValue={text}
      isDisabled={disabled}
      data-slot={slot}
      className={({isFocused}) =>
        styles.ListBoxOption(
          {highlighted: isFocused},
          styler.merge({className})
        )
      }
    >
      {({isSelected}) => (
        <>
          {icon && (
            <Icon
              icon={icon}
              data-slot={`${slot}-icon`}
              className={styles.ListBoxOption.icon()}
            />
          )}
          <span className={styles.ListBoxOption.content()}>
            <Text
              slot="label"
              data-slot={`${slot}-text`}
              className={styles.ListBoxOption.label()}
            >
              {children}
            </Text>
            {description && (
              <Text
                slot="description"
                data-slot={`${slot}-description`}
                className={styles.ListBoxOption.description()}
              >
                {description}
              </Text>
            )}
          </span>
          {isSelected && (
            <Icon
              icon={IcRoundCheck}
              data-slot={`${slot}-indicator`}
              className={styles.ListBoxOption.indicator()}
            />
          )}
        </>
      )}
    </ListBoxItem>
  )
}
