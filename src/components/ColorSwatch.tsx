import styler from '@alinea/styler'
import {ColorSwatch as ColorSwatchPrimitive} from 'react-aria-components'
import css from './ColorSwatch.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface ColorSwatchProps extends StyleProps, AriaProps, DataProps {
  /** Any CSS color, eg. `#f80` or `rgb(255 128 0 / 50%)` */
  color: string
  /** Accessible name of the color, derived from the color if left out */
  colorName?: string
}

/** Shows a color on a checkerboard so transparency is visible */
export function ColorSwatch({
  color,
  colorName,
  className,
  style,
  ...props
}: ColorSwatchProps) {
  return (
    <ColorSwatchPrimitive
      data-slot="color-swatch"
      {...props}
      color={color}
      colorName={colorName}
      className={styles.ColorSwatch(styler.merge({className}))}
      style={{
        background: `linear-gradient(${color}, ${color}), repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 16px 16px`,
        ...style
      }}
    />
  )
}
