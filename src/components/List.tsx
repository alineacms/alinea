import styler from '@alinea/styler'
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  HTMLAttributes,
  ReactNode
} from 'react'
import {Button, type ButtonProps} from './Button.js'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import {SharedLabelBadge} from './Label.js'
import css from './List.module.css'
import {Surface, SurfaceRow, type SurfaceProps} from './Surface.js'

const styles = styler(css)

export interface ListProps extends SurfaceProps {}

export function List({className, ...props}: ListProps) {
  return <Surface role="list" {...props} className={className} />
}

export interface ListItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  leading?: ReactNode
  trailing?: ReactNode
  inner?: ReactNode
}

export function ListItem({
  leading,
  trailing,
  inner,
  children,
  ...props
}: ListItemProps) {
  return (
    <SurfaceRow {...props} className={styles.ListItem(styler.merge(props))}>
      <header className={styles.ListItem.header()}>
        {leading && <div className={styles.ListItem.leading()}>{leading}</div>}
        {children && (
          <div className={styles.ListItem.content()}>{children}</div>
        )}
        {trailing && (
          <div className={styles.ListItem.trailing()}>{trailing}</div>
        )}
      </header>
      {inner && <div className={styles.ListItem.inner()}>{inner}</div>}
    </SurfaceRow>
  )
}

export interface ListLabelProps extends Omit<
  ButtonProps,
  'appearance' | 'children' | 'className' | 'size'
> {
  children: ReactNode
  className?: string
  description?: ReactNode
  expanded: boolean
  hasRows?: boolean
  shared?: boolean
  showFold?: boolean
}

export function ListLabel({
  children,
  description,
  expanded,
  hasRows,
  shared,
  showFold = true,
  className,
  ...props
}: ListLabelProps) {
  return (
    <div className={styles.ListLabelHeader(styler.merge({className}))}>
      <Button
        {...props}
        appearance="plain"
        className={styles.ListLabel()}
        data-has-rows={hasRows ? 'true' : undefined}
        isDisabled={props.isDisabled ?? !hasRows}
      >
        {children}
        {showFold && (
          <FoldIcon aria-hidden data-slot="icon" expanded={expanded} />
        )}
        {shared && <SharedLabelBadge />}
      </Button>
      {description && (
        <div className={styles.ListLabelDescription()}>{description}</div>
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
    />
  )
}

export interface ListRowHeaderProps extends ComponentPropsWithoutRef<'div'> {
  expanded?: boolean
  first?: boolean
  hasFold?: boolean
}

export function ListRowHeader({
  className,
  expanded,
  first,
  hasFold = true,
  ...props
}: ListRowHeaderProps) {
  return (
    <div
      {...props}
      className={styles.ListRowHeader(styler.merge({className}))}
      data-expanded={expanded ? 'true' : undefined}
      data-first-row={first ? 'true' : undefined}
      data-has-fold={hasFold ? 'true' : undefined}
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
      className={styles.ListRowFoldButton(styler.merge({className}))}
      size="icon-small"
    >
      <FoldIcon
        aria-hidden
        className={styles.ListRowFoldButton.icon()}
        expanded={expanded}
      />
    </Button>
  )
}

export interface ListRowSettingsButtonProps extends Omit<
  ButtonProps,
  'appearance' | 'className' | 'size'
> {
  className?: string
}

export function ListRowSettingsButton({
  className,
  ...props
}: ListRowSettingsButtonProps) {
  return (
    <Button
      {...props}
      appearance="plain"
      className={styles.ListRowSettingsButton(styler.merge({className}))}
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
