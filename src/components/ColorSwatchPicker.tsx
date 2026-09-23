import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  ColorSwatchPicker as ColorSwatchPickerPrimitive,
  ColorSwatchPickerItem as ColorSwatchPickerItemPrimitive
} from 'react-aria-components'
import {ColorSwatch} from './ColorSwatch.js'
import css from './ColorSwatchPicker.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface ColorSwatchPickerProps
  extends StyleProps, AriaProps, DataProps {
  /** The selected color */
  value?: string
  defaultValue?: string
  onValueChange?: (color: string) => void
  /** Lay the swatches out in a wrapping row, or a column */
  layout?: 'grid' | 'stack'
  children?: ReactNode
}

/** A list of color swatches to pick one color from */
export function ColorSwatchPicker({
  value,
  defaultValue,
  onValueChange,
  layout = 'grid',
  className,
  ...props
}: ColorSwatchPickerProps) {
  return (
    <ColorSwatchPickerPrimitive
      data-slot="color-swatch-picker"
      {...props}
      value={value}
      defaultValue={defaultValue}
      onChange={color =>
        onValueChange?.(
          color.toString(color.getChannelValue('alpha') < 1 ? 'hexa' : 'hex')
        )
      }
      layout={layout}
      className={styles.ColorSwatchPicker(styler.merge({className}))}
    />
  )
}

export interface ColorSwatchPickerItemProps
  extends StyleProps, AriaProps, DataProps {
  color: string
  disabled?: boolean
}

export function ColorSwatchPickerItem({
  color,
  disabled,
  className,
  ...props
}: ColorSwatchPickerItemProps) {
  return (
    <ColorSwatchPickerItemPrimitive
      data-slot="color-swatch-picker-item"
      {...props}
      color={color}
      isDisabled={disabled}
      className={styles.ColorSwatchPickerItem(styler.merge({className}))}
    >
      <ColorSwatch color={color} />
    </ColorSwatchPickerItemPrimitive>
  )
}
