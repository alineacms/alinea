import styler from '@alinea/styler'
import {IcRoundUnfoldLess, IcRoundUnfoldMore} from '#/dashboard/icons.js'
import type {ComponentPropsWithoutRef, HTMLAttributes, ReactNode} from 'react'
import {Button, type ButtonProps} from './Button.js'
import {FieldDescription, FieldSharedBadge} from './Field.js'
import {Icon} from './Icon.js'
import css from './List.module.css'
import {Surface, SurfaceRow, type SurfaceProps} from './Surface.js'
import type {IconType} from './types.js'

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
  className,
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
      data-slot="list-item"
      {...props}
      className={styles.ListItem(styler.merge({className}))}
      data-has-leading={leading ? 'true' : undefined}
      data-selected={selected || undefined}
      role={props.role ?? 'listitem'}
    >
      {onClick ? (
        <Button
          variant="ghost"
          aria-pressed={selected}
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

export interface ListItemVisualProps extends ComponentPropsWithoutRef<'span'> {
  /** An image that covers the visual, such as a thumbnail */
  src?: string
  /** `lg` fits a thumbnail, defaults to `default` */
  size?: 'default' | 'lg'
}

export function ListItemVisual({
  className,
  src,
  size = 'default',
  children,
  ...props
}: ListItemVisualProps) {
  return (
    <span
      data-slot="list-item-visual"
      data-size={size}
      {...props}
      className={styles.ListItemVisual(styler.merge({className}))}
    >
      {src && (
        <img
          alt=""
          src={src}
          data-slot="list-item-visual-image"
          className={styles.ListItemVisual.image()}
        />
      )}
      {children}
    </span>
  )
}

export interface ListItemTitleProps extends ComponentPropsWithoutRef<'span'> {}

export function ListItemTitle({className, ...props}: ListItemTitleProps) {
  return (
    <span
      data-slot="list-item-title"
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
      data-slot="list-item-description"
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
  icon?: IconType
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
    <div
      data-slot="list-empty"
      {...props}
      className={styles.ListEmpty(styler.merge({className}))}
    >
      {icon && (
        <ListItemVisual>
          <Icon icon={icon} />
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
  'variant' | 'children' | 'size'
> {
  children: ReactNode
  expanded: boolean
  hasRows?: boolean
  /** Number of items, shown next to the label */
  count?: number
  shared?: boolean
  /** Marks the label with an asterisk, like a required field label */
  required?: boolean
  /** Shows the button that expands or collapses all rows */
  showFold?: boolean
  description?: ReactNode
  inline?: boolean
}

export function ListLabel({
  children,
  expanded,
  hasRows,
  count,
  shared,
  required,
  showFold = true,
  className,
  description,
  inline = false,
  ...props
}: ListLabelProps) {
  const fold = showFold && hasRows
  if (inline && !fold && !description && !shared) return null
  return (
    <div
      data-slot="list-label"
      className={styles.ListLabel(styler.merge({className}))}
    >
      <div className={styles.ListLabel.header()}>
        <span className={styles.ListLabel.title()}>
          {!inline && (
            <span className={styles.ListLabel.title.text()}>
              {children}
              {required && (
                <span
                  data-slot="list-label-required"
                  className={styles.ListLabel.required()}
                >
                  {' *'}
                </span>
              )}
            </span>
          )}
          {!inline && count !== undefined && (
            <span
              data-slot="list-label-count"
              className={styles.ListLabel.count()}
            >
              {count}
            </span>
          )}
          {shared && <FieldSharedBadge />}
        </span>
        {fold && (
          <Button
            {...props}
            variant="ghost"
            size="sm"
            icon={expanded ? IcRoundUnfoldLess : IcRoundUnfoldMore}
            className={styles.ListLabel.toggle()}
            aria-expanded={expanded}
          >
            {expanded ? 'Collapse all' : 'Expand all'}
          </Button>
        )}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </div>
  )
}

export interface ListErrorProps extends ComponentPropsWithoutRef<'div'> {}

export function ListError({className, ...props}: ListErrorProps) {
  return (
    <div
      data-slot="list-error"
      {...props}
      className={styles.ListError(styler.merge({className}))}
    />
  )
}
