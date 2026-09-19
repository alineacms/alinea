import styler from '@alinea/styler'
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  HTMLAttributes,
  MouseEvent,
  ReactNode
} from 'react'
import {
  IcRoundAdd,
  IcRoundUnfoldLess,
  IcRoundUnfoldMore
} from '../dashboard/icons.js'
import css from './List.module.css'
import {Button, type ButtonProps} from './Button.js'
import {Icon} from './Icon.js'
import {SharedLabelBadge} from './Label.js'

const styles = styler(css)

export interface ListProps extends ComponentPropsWithoutRef<'div'> {
  empty?: boolean
}

export function List({className, empty, role, ...props}: ListProps) {
  return (
    <div
      {...props}
      className={styles.List(styler.merge({className}))}
      role={role ?? (empty ? 'status' : 'list')}
    />
  )
}

export interface ListItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  leading?: ReactNode
  trailing?: ReactNode
  inner?: ReactNode
  onPress?: ButtonProps['onPress']
  selected?: boolean
}

export function ListItem({
  leading,
  trailing,
  inner,
  children,
  onPress,
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
    <div
      {...props}
      className={styles.ListItem(styler.merge(props))}
      data-has-leading={leading ? 'true' : undefined}
      data-selected={selected || undefined}
      role={props.role ?? 'listitem'}
    >
      {onPress ? (
        <Button
          appearance="plain"
          aria-pressed={selected || undefined}
          className={styles.ListItem.header()}
          data-action="true"
          onPress={onPress}
        >
          {headerContent}
        </Button>
      ) : (
        <header className={styles.ListItem.header()}>{headerContent}</header>
      )}
      {inner && <div className={styles.ListItem.inner()}>{inner}</div>}
    </div>
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
  tone?: 'neutral' | 'accent' | 'positive' | 'warning' | 'danger'
}

export function ListItemStatus({
  className,
  tone = 'neutral',
  ...props
}: ListItemStatusProps) {
  return (
    <span
      {...props}
      className={styles.ListItemStatus(styler.merge({className}))}
      data-tone={tone}
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
  'appearance' | 'children' | 'className' | 'size'
> {
  children: ReactNode
  className?: string
  count?: number
  expanded: boolean
  hasRows?: boolean
  addLabel?: string
  onAdd?: ButtonProps['onPress']
  shared?: boolean
  showFold?: boolean
  description?: ReactNode
  inline?: boolean
}

export function ListLabel({
  children,
  addLabel = 'Add item',
  count,
  expanded,
  hasRows,
  shared,
  showFold = true,
  className,
  description,
  inline = false,
  onAdd,
  ...props
}: ListLabelProps) {
  return (
    <div
      className={styles.ListLabel(styler.merge({className}))}
      data-inline={inline || undefined}
    >
      <div className={styles.ListLabel.header()}>
        <div className={styles.ListLabel.title()}>
          <span className={styles.ListLabel.label()}>{children}</span>
          {count !== undefined && (
            <span className={styles.ListLabel.count()}>{count}</span>
          )}
          {shared && <SharedLabelBadge />}
        </div>
        <div className={styles.ListLabel.actions()}>
          {showFold && hasRows && (
            <Button
              {...props}
              appearance="plain"
              aria-expanded={expanded}
              className={styles.ListLabel.action()}
              icon={expanded ? IcRoundUnfoldLess : IcRoundUnfoldMore}
              isDisabled={props.isDisabled ?? !hasRows}
              size="small"
            >
              {expanded ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
          {onAdd && (
            <Button
              appearance="plain"
              aria-label={addLabel}
              className={styles.ListLabel.add()}
              icon={IcRoundAdd}
              onPress={onAdd}
              size="icon-small"
            />
          )}
        </div>
      </div>
      {description && (
        <div className={styles.ListLabel.description()}>{description}</div>
      )}
    </div>
  )
}

export interface ListErrorProps extends ComponentPropsWithoutRef<'div'> {}

export function ListError({className, ...props}: ListErrorProps) {
  return (
    <div {...props} className={styles.ListError(styler.merge({className}))} />
  )
}

export interface ListCreateRowProps extends ComponentPropsWithoutRef<'div'> {
  empty?: boolean
}

export function ListCreateRow({
  children,
  className,
  empty,
  ...props
}: ListCreateRowProps) {
  return (
    <div
      {...props}
      className={styles.ListCreateRow(styler.merge({className}))}
      data-empty={empty || undefined}
    >
      <div className={styles.ListCreateRow.inner()}>{children}</div>
    </div>
  )
}

export interface ListCreateButtonProps extends Omit<
  ButtonProps,
  'appearance' | 'size'
> {
  name: string
}

export function ListCreateButton({
  className,
  name,
  ...props
}: ListCreateButtonProps) {
  return (
    <Button
      {...props}
      appearance="plain"
      className={renderProps =>
        styles.ListCreateButton(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
      data-color={listRowTypeColor(name)}
      size="small"
    />
  )
}

export interface ListTypeIconProps extends Omit<
  ComponentPropsWithoutRef<'span'>,
  'children'
> {
  icon: ComponentType
  name: string
}

export function ListTypeIcon({
  className,
  icon,
  name,
  ...props
}: ListTypeIconProps) {
  return (
    <span
      {...props}
      className={styles.ListTypeIcon(styler.merge({className}))}
      data-color={listRowTypeColor(name)}
    >
      <Icon aria-hidden icon={icon} />
    </span>
  )
}

export interface ListRowProps extends ComponentPropsWithoutRef<'div'> {
  dragging?: boolean
  first?: boolean
}

export function ListRow({className, dragging, first, ...props}: ListRowProps) {
  return (
    <div
      {...props}
      className={styles.ListRow(styler.merge({className}))}
      data-dragging={dragging || undefined}
      data-first-row={
        first === undefined ? undefined : first ? 'true' : 'false'
      }
    />
  )
}

export interface ListRowDragHandleProps extends ComponentPropsWithoutRef<'span'> {
  dragging?: boolean
}

export function ListRowDragHandle({
  className,
  dragging,
  ...props
}: ListRowDragHandleProps) {
  return (
    <span
      {...props}
      className={styles.ListRowDragHandle(styler.merge({className}))}
      data-dragging={dragging || undefined}
    >
      <Icon aria-hidden icon={IcRoundUnfoldMore} />
    </span>
  )
}

export interface ListRowHeaderProps extends ComponentPropsWithoutRef<'div'> {
  expanded?: boolean
  first?: boolean
  hasFold?: boolean
  onToggle?: () => void
}

export function ListRowHeader({
  className,
  expanded,
  first,
  hasFold = true,
  onClick,
  onToggle,
  ...props
}: ListRowHeaderProps) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    onClick?.(event)
    if (event.defaultPrevented || !onToggle) return
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('button, a, input, select, textarea, [role="button"]')
    )
      return
    onToggle()
  }

  return (
    <div
      {...props}
      className={styles.ListRowHeader(styler.merge({className}))}
      data-expanded={expanded ? 'true' : undefined}
      data-first-row={first ? 'true' : undefined}
      data-has-fold={hasFold ? 'true' : undefined}
      onClick={handleClick}
    />
  )
}

export interface ListRowDragProps extends ComponentPropsWithoutRef<'div'> {
  dragging?: boolean
}

export function ListRowDrag({className, dragging, ...props}: ListRowDragProps) {
  return (
    <div
      {...props}
      className={styles.ListRowDrag(styler.merge({className}))}
      data-dragging={dragging || undefined}
    />
  )
}

export interface ListRowBadgesProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowBadges({className, ...props}: ListRowBadgesProps) {
  return (
    <div
      {...props}
      className={styles.ListRowBadges(styler.merge({className}))}
    />
  )
}

export interface ListRowTypeProps extends ComponentPropsWithoutRef<'span'> {
  icon?: ComponentType
  name?: string
}

export function ListRowType({
  children,
  className,
  icon,
  name,
  ...props
}: ListRowTypeProps) {
  const colorName =
    name ?? (typeof children === 'string' ? children : undefined)
  return (
    <span
      {...props}
      className={styles.ListRowType(styler.merge({className}))}
      data-color={colorName ? listRowTypeColor(colorName) : undefined}
    >
      {icon && <Icon aria-hidden data-slot="icon" icon={icon} />}
      <span className={styles.ListRowType.label()}>{children}</span>
    </span>
  )
}

function listRowTypeColor(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index++) {
    hash = Math.imul(hash, 31) + name.charCodeAt(index)
  }
  return (hash >>> 0) % 5
}

export interface ListRowMetaProps extends ComponentPropsWithoutRef<'span'> {}

export function ListRowMeta({className, ...props}: ListRowMetaProps) {
  return (
    <span
      {...props}
      className={styles.ListRowMeta(styler.merge({className}))}
    />
  )
}

export interface ListRowActionsProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowActions({className, ...props}: ListRowActionsProps) {
  return (
    <div
      {...props}
      className={styles.ListRowActions(styler.merge({className}))}
    />
  )
}

export interface ListRowFoldButtonProps extends Omit<
  ButtonProps,
  'appearance' | 'children' | 'className' | 'size'
> {
  className?: string
  expanded: boolean
}

export function ListRowFoldButton({
  className,
  expanded,
  ...props
}: ListRowFoldButtonProps) {
  return (
    <Button
      {...props}
      appearance="plain"
      aria-expanded={expanded}
      className={styles.ListRowFoldButton(styler.merge({className}))}
      icon={expanded ? IcRoundUnfoldLess : IcRoundUnfoldMore}
      size="icon-small"
    />
  )
}

export interface ListRowBodyProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowBody({className, ...props}: ListRowBodyProps) {
  return (
    <div {...props} className={styles.ListRowBody(styler.merge({className}))} />
  )
}

export interface ListRowFooterProps extends ComponentPropsWithoutRef<'div'> {}

export function ListRowFooter({className, ...props}: ListRowFooterProps) {
  return (
    <div
      {...props}
      className={styles.ListRowFooter(styler.merge({className}))}
    />
  )
}

export interface ListRowSettingsProps extends ComponentPropsWithoutRef<'div'> {
  actions?: boolean
}

export function ListRowSettings({
  actions,
  className,
  ...props
}: ListRowSettingsProps) {
  return (
    <div
      {...props}
      className={styles.ListRowSettings(styler.merge({className}))}
      data-actions={actions || undefined}
    />
  )
}

export interface ListDragPreviewProps extends ComponentPropsWithoutRef<'div'> {
  icon?: ComponentType
  label: ReactNode
}

export function ListDragPreview({
  className,
  icon,
  label,
  ...props
}: ListDragPreviewProps) {
  return (
    <div
      {...props}
      className={styles.ListDragPreview(styler.merge({className}))}
    >
      {icon && (
        <div className={styles.ListDragPreview.icon()}>
          <Icon aria-hidden icon={icon} />
        </div>
      )}
      <div className={styles.ListDragPreview.body()}>
        <strong className={styles.ListDragPreview.title()}>{label}</strong>
      </div>
    </div>
  )
}
