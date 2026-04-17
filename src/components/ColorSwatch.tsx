import styler from '@alinea/styler'
import {
  ColorSwatch as AriaColorSwatch,
  type ColorSwatchProps
} from 'react-aria-components'

import css from './ColorSwatch.module.css'

const styles = styler(css)

export function ColorSwatch(props: ColorSwatchProps) {
  const {className, ...rest} = props
  return (
    <AriaColorSwatch
      {...rest}
      className={renderProps =>
        styles.ColorSwatch(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
      style={({color}) => ({
        background: `linear-gradient(${color}, ${color}),
          repeating-conic-gradient(#CCC 0% 25%, white 0% 50%) 50% / 16px 16px`
      })}
    />
  )
}
