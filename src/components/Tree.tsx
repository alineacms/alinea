import styler from '@alinea/styler'
import {type ReactNode, memo} from 'react'
import {
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
  type TreeItemContentProps as AriaTreeItemContentProps,
  type TreeItemProps as AriaTreeItemProps,
  Button,
  type TreeItemContentRenderProps,
  type TreeProps
} from 'react-aria-components'
import {Checkbox} from './Checkbox.js'
import {FoldIcon} from './FoldIcon.js'
import {Icon, type IconProps} from './Icon.js'
import css from './Tree.module.css'

const styles = styler(css)

export function Tree<T extends object>(props: TreeProps<T>) {
  const {className, ...rest} = props
  return (
    <AriaTree
      {...rest}
      className={renderProps =>
        styles.Tree(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}

export interface TreeItemContentProps extends Omit<
  AriaTreeItemContentProps,
  'children'
> {
  children?: ReactNode
  icon?: IconProps['icon']
  suffix?: ReactNode
}

export const TreeItemContent = memo(function TreeItemContent({
  icon,
  suffix,
  children
}: TreeItemContentProps) {
  return (
    <AriaTreeItemContent>
      {({
        selectionBehavior,
        selectionMode,
        allowsDragging,
        isDragging,
        isExpanded
      }: TreeItemContentRenderProps) => (
        <>
          {selectionBehavior === 'toggle' && selectionMode !== 'none' && (
            <Checkbox slot="selection" />
          )}
          <div className={styles.TreeItem.controls()}>
            <Button
              slot="drag"
              data-invisible={!isDragging}
              className={styles.TreeItem.dragHandle()}
            >
              ≡
            </Button>
            <Button
              slot="chevron"
              data-invisible={isDragging}
              className={styles.TreeItem.chevron()}
            >
              <FoldIcon
                aria-hidden
                className={styles.TreeItem.foldIcon()}
                expanded={isExpanded}
              />
            </Button>
          </div>
          {icon && (
            <span data-slot="icon">
              <Icon icon={icon} />
            </span>
          )}
          <span data-slot="label">{children}</span>
          {suffix && <span data-slot="suffix">{suffix}</span>}
        </>
      )}
    </AriaTreeItemContent>
  )
})

export interface TreeItemProps extends Partial<AriaTreeItemProps> {
  title: string
  icon?: IconProps['icon']
  label?: ReactNode
  suffix?: ReactNode
}

export function TreeItem({
  title,
  icon,
  label,
  suffix,
  children,
  className,
  hasChildItems,
  ...rest
}: TreeItemProps) {
  return (
    <AriaTreeItem
      textValue={title}
      {...rest}
      hasChildItems={hasChildItems}
      className={renderProps =>
        styles.TreeItem(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <TreeItemContent icon={icon} suffix={suffix}>
        {label ?? title}
      </TreeItemContent>
      {children}
    </AriaTreeItem>
  )
}
