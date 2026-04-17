import styler from '@alinea/styler'
import {
  ColorSwatchPicker as AriaColorSwatchPicker,
  ColorSwatchPickerItem as AriaColorSwatchPickerItem,
  type ColorSwatchPickerItemProps,
  type ColorSwatchPickerProps
} from 'react-aria-components'
import {ColorSwatch} from './ColorSwatch.js'
import css from './ColorSwatchPicker.module.css'

const styles = styler(css)

export function ColorSwatchPicker({
  children,
  ...props
}: ColorSwatchPickerProps) {
  const {className, ...rest} = props
  return (
    <AriaColorSwatchPicker
      {...rest}
      className={renderProps =>
        styles.ColorSwatchPicker(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {children}
    </AriaColorSwatchPicker>
  )
}

export function ColorSwatchPickerItem(props: ColorSwatchPickerItemProps) {
  const {className, ...rest} = props
  return (
    <AriaColorSwatchPickerItem
      {...rest}
      className={renderProps =>
        styles.ColorSwatchPickerItem(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <ColorSwatch />
    </AriaColorSwatchPickerItem>
  )
}
