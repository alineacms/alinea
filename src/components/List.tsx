import styler from '@alinea/styler'
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  HTMLAttributes,
  ReactNode
} from 'react'
import {Button, type ButtonProps} from './Button.js'
import {FieldDescription, FieldSharedBadge} from './Field.js'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import css from './List.module.css'
import {Surface, SurfaceRow, type SurfaceProps} from './Surface.js'

const styles = styler(css)

export interface ListProps extends SurfaceProps {
  /** Renders the list as a status region, for a list holding `ListEmpty` */
  empty?: boolean
}

export function List({className, empty, role, ...props}: ListProps) {
  return (
    <Surface
      data-slot="list"
      {...props}
      className={className}
      role={role ?? (empty ? 'status' : 'list')}
    />
  )
}

export interface ListItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title' | 'onClick'
> {
  leading?: ReactNode
  trailing?: ReactNode
  inner?: ReactNode
  /** Makes the item actionable: its header renders as a button */
  onClick?: () => void
  selected?: boolean
}

export function ListItem({
  leading,
  trailing,
  inner,
  children,
  onClick,
  selected,
  ...props
}: ListItemProps) {
  const headerContent = (
    <>
      {leading && <div className={styles.ListItem.leading()}>{leading}</div>}
      {children && <div className={styles.ListItem.content()}>{children}</div>}
      {trailing && <div className={styles.ListItem.trailing()}>{trailing}</div>}
    </>
  )
  return (
    <SurfaceRow
      {...props}
      className={styles.ListItem(styler.merge(props))}
      data-has-leading={leading ? 'true' : undefined}
      data-selected={selected || undefined}
      role={props.role ?? 'listitem'}
    >
      {onClick ? (
        <Button
          variant="ghost"
          aria-pressed={selected || undefined}
          className={styles.ListItem.header()}
          data-action="true"
          onClick={() => onClick()}
        >
          {headerContent}
        </Button>
      ) : (
        <header className={styles.ListItem.header()}>{headerContent}</header>
      )}
      {inner && <div className={styles.ListItem.inner()}>{inner}</div>}
    </SurfaceRow>
  )
}

export interface ListItemVisualProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemVisual({className, ...props}: ListItemVisualProps) {
  return (
    <span
      {...props}
      className={styles.ListItemVisual(styler.merge({className}))}
    />
  )
}

export interface ListItemTitleProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemTitle({className, ...props}: ListItemTitleProps) {
  return (
    <span
      {...props}
      className={styles.ListItemTitle(styler.merge({className}))}
    />
  )
}

export interface ListItemDescriptionProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemDescription({
  className,
  ...props
}: ListItemDescriptionProps) {
  return (
    <span
      {...props}
      className={styles.ListItemDescription(styler.merge({className}))}
    />
  )
}

export interface ListItemStatusProps extends ComponentPropsWithoutRef<'span'> {
  /** Color of the text and its dot, defaults to `muted` */
  color?:
    | 'default'
    | 'muted'
    | 'primary'
    | 'destructive'
    | 'warning'
    | 'success'
}

export function ListItemStatus({
  className,
  color = 'muted',
  ...props
}: ListItemStatusProps) {
  return (
    <span
      data-slot="list-item-status"
      {...props}
      className={styles.ListItemStatus(styler.merge({className}))}
      data-color={color}
    />
  )
}

export interface ListEmptyProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'title'
> {
  icon?: ComponentType
  title: ReactNode
}

export function ListEmpty({
  children,
  className,
  icon,
  title,
  ...props
}: ListEmptyProps) {
  return (
    <div {...props} className={styles.ListEmpty(styler.merge({className}))}>
      {icon && (
        <ListItemVisual>
          <Icon data-slot="icon" icon={icon} />
        </ListItemVisual>
      )}
      <div className={styles.ListEmpty.content()}>
        <strong className={styles.ListEmpty.title()}>{title}</strong>
        {children && (
          <span className={styles.ListEmpty.description()}>{children}</span>
        )}
      </div>
    </div>
  )
}

export interface ListLabelProps extends Omit<
  ButtonProps,
  'variant' | 'children' | 'className' | 'size'
> {
  children: ReactNode
  className?: string
  expanded: boolean
  hasRows?: boolean
  shared?: boolean
  showFold?: boolean
  description?: ReactNode
  inline?: boolean
}

export function ListLabel({
  children,
  expanded,
  hasRows,
  shared,
  showFold = true,
  className,
  description,
  inline = false,
  ...props
}: ListLabelProps) {
  if (inline && !showFold && !description && !shared) return null

  return (
    <div className={styles.ListLabel(styler.merge({className}))}>
      {(!inline || showFold) && (
        <Button
          {...props}
          variant="ghost"
          className={styles.ListLabel.toggle()}
          data-has-rows={hasRows ? 'true' : undefined}
          disabled={props.disabled ?? !hasRows}
        >
          <span className={styles.ListLabel.title()}>
            {!inline && (
              <span className={styles.ListLabel.title.text()}>{children}</span>
            )}
            {showFold && (
              <FoldIcon aria-hidden data-slot="icon" expanded={expanded} />
            )}
          </span>
        </Button>
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {shared && <FieldSharedBadge />}
    </div>
  )
}

export interface ListErrorProps extends ComponentPropsWithoutRef<'div'> {}

export function ListError({className, ...props}: ListErrorProps) {
  return (
    <div {...props} className={styles.ListError(styler.merge({className}))} />
  )
}
