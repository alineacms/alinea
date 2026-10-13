import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {Header, ListBoxSection} from 'react-aria-components'
import type {AriaProps} from '../types.js'
import css from './ListBoxGroup.module.css'

const styles = styler(css)

export interface ListBoxGroupProps extends AriaProps {
  /** data-slot of the group, eg. "select-group" */
  slot: string
  /** data-slot of its label */
  labelSlot: string
  label?: ReactNode
  children: ReactNode
}

/** A labelled group of options in the listbox of a Select or ComboBox */
export function ListBoxGroup({
  slot,
  labelSlot,
  label,
  children,
  ...props
}: ListBoxGroupProps) {
  return (
    <ListBoxSection
      data-slot={slot}
      {...props}
      className={styles.ListBoxGroup()}
    >
      {label && (
        <Header data-slot={labelSlot} className={styles.ListBoxGroup.label()}>
          {label}
        </Header>
      )}
      {children}
    </ListBoxSection>
  )
}
