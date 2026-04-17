import styler from '@alinea/styler'
import type {
  TagGroupProps as TagGroupPrimitiveProps,
  TagListProps,
  TagProps
} from 'react-aria-components'
import {
  Button,
  TagGroup as TagGroupPrimitive,
  TagList,
  Tag as TagPrimitive
} from 'react-aria-components'
import {IcRoundCancel} from '../stories/icons/IcRoundCancel.js'
import {Icon} from './Icon.js'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import css from './TagGroup.module.css'

const styles = styler(css)

export type IntentProps = 'primary' | 'secondary'
export type ShapeProps = 'square' | 'circle'

export interface TagGroupProps<T>
  extends
    Omit<TagGroupPrimitiveProps, 'children'>,
    Pick<TagListProps<T>, 'items' | 'children'>,
    LabelSharedProps {
  intent?: IntentProps
  shape?: ShapeProps
}

export function TagGroup<T extends object>({
  items,
  children,
  intent,
  shape,
  ...props
}: TagGroupProps<T>) {
  return (
    <TagGroupPrimitive
      data-intent={intent}
      data-shape={shape}
      {...props}
      className={styles.TagGroup(
        styler.merge({
          className:
            typeof props.className === 'string' ? props.className : undefined
        })
      )}
    >
      <Label {...labelProps(props)}>
        <TagList items={items} className={styles.TagGroup.list()}>
          {children}
        </TagList>
      </Label>
    </TagGroupPrimitive>
  )
}

export function Tag({children, ...props}: TagProps) {
  const textValue = typeof children === 'string' ? children : undefined
  const {className, ...rest} = props
  return (
    <TagPrimitive
      textValue={textValue}
      {...rest}
      className={renderProps =>
        styles.Tag(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {({allowsRemoving}) => (
        <>
          {children}
          {allowsRemoving && (
            <Button slot="remove">
              <Icon icon={IcRoundCancel} />
            </Button>
          )}
        </>
      )}
    </TagPrimitive>
  )
}
