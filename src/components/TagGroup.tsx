import styler from '@alinea/styler'
import {createContext, type ReactNode, useContext} from 'react'
import {
  Button as ButtonPrimitive,
  TagGroup as TagGroupPrimitive,
  TagList as TagListPrimitive,
  Tag as TagPrimitive
} from 'react-aria-components'
import {IcRoundClose} from '../dashboard/icons.js'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import css from './TagGroup.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  Key,
  SelectionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

type TagVariant = 'primary' | 'secondary'
type TagShape = 'square' | 'circle'

interface TagAppearance {
  variant?: TagVariant
  shape?: TagShape
}

const TagAppearanceContext = createContext<TagAppearance>({})

export interface TagGroupProps
  extends FieldSharedProps, SelectionProps, StyleProps, AriaProps, DataProps {
  variant?: TagVariant
  shape?: TagShape
  /** Shows a remove button on every tag */
  onRemove?: (keys: Set<Key>) => void
  /** `Tag` elements */
  children?: ReactNode
}

export function TagGroup({
  label,
  description,
  error,
  required,
  disabled,
  readOnly,
  icon,
  shared,
  variant = 'primary',
  shape = 'square',
  selectionMode,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disabledKeys,
  onRemove,
  className,
  children,
  ...props
}: TagGroupProps) {
  return (
    <TagGroupPrimitive
      data-slot="tag-group"
      {...props}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      className={styles.TagGroup(styler.merge({className}))}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      defaultSelectedKeys={defaultSelectedKeys}
      onSelectionChange={disabled || readOnly ? undefined : onSelectionChange}
      disabledKeys={disabledKeys}
      onRemove={disabled || readOnly ? undefined : onRemove}
    >
      <Field
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        icon={icon}
        shared={shared}
      >
        <TagAppearanceContext.Provider value={{variant, shape}}>
          <TagListPrimitive
            data-slot="tag-group-list"
            className={styles.TagGroup.list()}
          >
            {children}
          </TagListPrimitive>
        </TagAppearanceContext.Provider>
      </Field>
    </TagGroupPrimitive>
  )
}

export interface TagProps extends StyleProps, DataProps {
  /** Key of the tag, used in the selection and in `onRemove` */
  id?: Key
  /** Text for keyboard navigation and screen readers, inferred from a string child */
  textValue?: string
  disabled?: boolean
  /** Defaults to the variant of the surrounding `TagGroup` */
  variant?: TagVariant
  /** Defaults to the shape of the surrounding `TagGroup` */
  shape?: TagShape
  children: ReactNode
}

export function Tag({
  variant,
  shape,
  disabled,
  textValue,
  className,
  children,
  ...props
}: TagProps) {
  const appearance = useContext(TagAppearanceContext)
  return (
    <TagPrimitive
      data-slot="tag"
      {...props}
      data-variant={variant ?? appearance.variant ?? 'primary'}
      data-shape={shape ?? appearance.shape ?? 'square'}
      textValue={
        textValue ?? (typeof children === 'string' ? children : undefined)
      }
      isDisabled={disabled}
      className={styles.Tag(styler.merge({className}))}
    >
      {({allowsRemoving}) => (
        <>
          {children}
          {allowsRemoving && (
            <ButtonPrimitive
              slot="remove"
              data-slot="tag-remove"
              className={styles.Tag.remove()}
            >
              <Icon icon={IcRoundClose} />
            </ButtonPrimitive>
          )}
        </>
      )}
    </TagPrimitive>
  )
}
