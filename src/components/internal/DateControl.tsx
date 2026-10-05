import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  Button,
  DateInput,
  DateSegment,
  Dialog,
  Group
} from 'react-aria-components'
import {IcRoundDateRange} from '#/dashboard/icons.js'
import {Icon} from '../Icon.js'
import css from './DateControl.module.css'
import {PopoverSurface} from './PopoverSurface.js'

const styles = styler(css)

export interface DateControlProps {
  /** Prefix of the data-slot of each part, eg. `date-picker` */
  dataSlot: string
  /** Shown in a popover when the trigger is pressed */
  calendar: ReactNode
  children: ReactNode
}

/** The framed inputs and calendar popover of the date pickers */
export function DateControl({dataSlot, calendar, children}: DateControlProps) {
  return (
    <>
      <Group data-slot={`${dataSlot}-control`} className={styles.DateControl()}>
        {children}
        <Button
          data-slot={`${dataSlot}-trigger`}
          className={styles.DateControl.trigger()}
        >
          <Icon icon={IcRoundDateRange} className={styles.DateControl.icon()} />
        </Button>
      </Group>
      <PopoverSurface data-slot={`${dataSlot}-content`}>
        <Dialog
          data-slot={`${dataSlot}-dialog`}
          className={styles.DateControl.dialog()}
        >
          {calendar}
        </Dialog>
      </PopoverSurface>
    </>
  )
}

export interface DateControlInputProps {
  /** Prefix of the data-slot of each part, eg. `date-picker` */
  dataSlot: string
  slot?: 'start' | 'end'
  /** Draw the input frame, for an input that is not inside a DateControl */
  framed?: boolean
}

export function DateControlInput({
  dataSlot,
  slot,
  framed
}: DateControlInputProps) {
  return (
    <DateInput
      slot={slot}
      data-slot={`${dataSlot}-input`}
      className={styles.DateControl.input({framed})}
    >
      {segment => (
        <DateSegment
          data-slot={`${dataSlot}-segment`}
          className={state =>
            styles.DateControl.segment({
              placeholder: state.isPlaceholder,
              literal: segment.type === 'literal'
            })
          }
          segment={segment}
        />
      )}
    </DateInput>
  )
}
