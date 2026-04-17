import styler from '@alinea/styler'
import {
  Button,
  Input,
  SearchField as SearchFieldPrimitive,
  type SearchFieldProps as SearchFieldPrimitiveProps
} from 'react-aria-components'
import {IcRoundClose, IcRoundSearch} from '../v2/icons.js'
import {Icon} from './Icon.js'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import {ProgressCircle} from './ProgressCircle.js'
import css from './SearchField.module.css'

const styles = styler(css)

export interface SearchFieldProps
  extends SearchFieldPrimitiveProps, LabelSharedProps {
  placeholder?: string
  hasIcon?: boolean
  isPending?: boolean
}

export function SearchField({hasIcon, isPending, ...props}: SearchFieldProps) {
  const {className, ...rest} = props
  return (
    <SearchFieldPrimitive
      {...rest}
      className={renderProps =>
        styles.SearchField(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <Label {...labelProps(props)}>
        <div className={styles.SearchField.field()}>
          {hasIcon && !isPending && (
            <Icon
              icon={IcRoundSearch}
              className={styles.SearchField.field.icon()}
            />
          )}
          {hasIcon && isPending && (
            <ProgressCircle
              isIndeterminate
              aria-label="Refreshing..."
              className={styles.SearchField.field.pending()}
            />
          )}
          <Input className={styles.SearchField.field.input()} />
          <Button className={styles.SearchField.field.clear()}>
            <Icon
              icon={IcRoundClose}
              className={styles.SearchField.field.clear.icon()}
            />
          </Button>
        </div>
      </Label>
    </SearchFieldPrimitive>
  )
}
