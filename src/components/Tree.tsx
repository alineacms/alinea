import styler from '@alinea/styler'
import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'
import {
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
  Button,
  Collection,
  ListLayout,
  Virtualizer
} from 'react-aria-components'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import {SelectionCheckbox} from './internal/SelectionCheckbox.js'
import {useDragDrop} from './internal/useDragDrop.js'
import css from './Tree.module.css'
import type {
  AriaProps,
  DataProps,
  DragDropProps,
  IconType,
  Key,
  SelectionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface TreeProps<T extends object>
  extends StyleProps, AriaProps, DataProps, SelectionProps, DragDropProps {
  /** Items to render with the `children` function */
  items?: Iterable<T>
  children: ReactNode | ((item: T) => ReactNode)
  expandedKeys?: Iterable<Key>
  defaultExpandedKeys?: Iterable<Key>
  onExpandedChange?: (keys: Set<Key>) => void
  /** Called when an item is activated (clicked or Enter) */
  onAction?: (key: Key) => void
  renderEmptyState?: () => ReactNode
  /** Only render the rows in view, every row must be `rowHeight` tall */
  virtualized?: boolean
  /** Row height in pixels when virtualized, defaults to 32 */
  rowHeight?: number
  ref?: Ref<HTMLDivElement>
}

export function Tree<T extends object>({
  className,
  style,
  items,
  children,
  selectionMode = 'none',
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disabledKeys,
  expandedKeys,
  defaultExpandedKeys,
  onExpandedChange,
  onAction,
  renderEmptyState,
  virtualized,
  rowHeight = 32,
  getDragData,
  acceptedDragTypes,
  canDrop,
  onReorder,
  onMove,
  onDropItems,
  onDropFiles,
  renderDragPreview,
  ref,
  ...props
}: TreeProps<T>) {
  const dnd = useDragDrop<T>({
    getDragData,
    acceptedDragTypes,
    canDrop,
    onReorder,
    onMove,
    onDropItems,
    onDropFiles,
    renderDragPreview,
    dropIndicatorSlot: 'tree-drop-indicator',
    dropIndicatorClassName: active => styles.TreeDropIndicator({active})
  })
  const tree = (
    <AriaTree
      {...props}
      key={dnd.key}
      ref={ref}
      data-slot="tree"
      className={styles.Tree(styler.merge({className}))}
      style={style}
      items={items}
      selectionMode={selectionMode}
      selectionBehavior={selectionMode === 'multiple' ? 'toggle' : 'replace'}
      selectedKeys={selectedKeys}
      defaultSelectedKeys={defaultSelectedKeys}
      onSelectionChange={onSelectionChange}
      disabledKeys={disabledKeys}
      expandedKeys={expandedKeys}
      defaultExpandedKeys={defaultExpandedKeys}
      onExpandedChange={onExpandedChange}
      onAction={onAction}
      renderEmptyState={
        renderEmptyState
          ? () => (
              <div data-slot="tree-empty" className={styles.Tree.empty()}>
                {renderEmptyState()}
              </div>
            )
          : undefined
      }
      dragAndDropHooks={dnd.dragAndDropHooks}
    >
      {children}
    </AriaTree>
  )
  if (!virtualized) return tree
  return (
    <Virtualizer
      layout={ListLayout}
      layoutOptions={{rowHeight, padding: 0, gap: 0}}
    >
      {tree}
    </Virtualizer>
  )
}

export interface TreeItemProps<T extends object = object>
  extends StyleProps, DataProps {
  id?: Key
  /** Plain text title, also used for typeahead */
  title: string
  /** Rendered instead of the title */
  label?: ReactNode
  icon?: IconType | ReactElement
  /** Renders the icon and title as links, pressing the row still selects */
  href?: string
  /** Trailing content such as status icons */
  suffix?: ReactNode
  /** Shows the expand button, set when children load lazily */
  hasChildItems?: boolean
  /** Set to false to hide the drag handle of this item */
  draggable?: boolean
  /** Child items to render with the `children` function */
  items?: Iterable<T>
  /** Nested tree items, or a function rendering each of `items` */
  children?: ReactNode | ((item: T) => ReactNode)
}

export function TreeItem<T extends object = object>({
  id,
  title,
  label,
  icon,
  href,
  suffix,
  hasChildItems,
  draggable = true,
  items,
  children,
  className,
  style,
  ...props
}: TreeItemProps<T>) {
  return (
    <AriaTreeItem
      {...props}
      id={id}
      textValue={title}
      hasChildItems={hasChildItems}
      data-slot="tree-item"
      className={renderProps =>
        styles.TreeItem(
          {
            // aria-expanded is missing on items whose children load lazily
            expandable: renderProps.hasChildItems,
            expanded: renderProps.hasChildItems && renderProps.isExpanded,
            dragging: renderProps.isDragging,
            dropTarget: renderProps.isDropTarget,
            allowsDragging: renderProps.allowsDragging
          },
          styler.merge({className})
        )
      }
      style={({level}) =>
        ({'--alinea-tree-level': level, ...style}) as CSSProperties
      }
    >
      <AriaTreeItemContent>
        {({
          selectionBehavior,
          selectionMode,
          allowsDragging,
          isDragging,
          isExpanded
        }) => (
          <>
            {selectionBehavior === 'toggle' && selectionMode !== 'none' && (
              <SelectionCheckbox />
            )}
            <div
              data-slot="tree-item-controls"
              className={styles.TreeItem.controls()}
            >
              {allowsDragging && draggable && (
                <Button
                  slot="drag"
                  data-slot="tree-item-drag-handle"
                  className={styles.TreeItem.dragHandle({
                    invisible: !isDragging
                  })}
                >
                  ≡
                </Button>
              )}
              <Button
                slot="chevron"
                data-slot="tree-item-chevron"
                className={styles.TreeItem.chevron({invisible: isDragging})}
              >
                <FoldIcon
                  aria-hidden
                  className={styles.TreeItem.foldIcon()}
                  expanded={isExpanded}
                />
              </Button>
            </div>
            {icon && (
              <span
                data-slot="tree-item-icon"
                className={styles.TreeItem.icon()}
              >
                {href ? (
                  <a
                    aria-hidden
                    className={styles.TreeItem.iconLink()}
                    href={href}
                    tabIndex={-1}
                  >
                    <Icon icon={icon} />
                  </a>
                ) : (
                  <Icon icon={icon} />
                )}
              </span>
            )}
            <span
              data-slot="tree-item-label"
              className={styles.TreeItem.label()}
            >
              {href && !label ? (
                <a className={styles.TreeItem.labelLink()} href={href}>
                  {title}
                </a>
              ) : (
                (label ?? title)
              )}
            </span>
            {suffix && (
              <span
                data-slot="tree-item-suffix"
                className={styles.TreeItem.suffix()}
              >
                {suffix}
              </span>
            )}
          </>
        )}
      </AriaTreeItemContent>
      {typeof children === 'function' ? (
        <Collection items={items}>{children}</Collection>
      ) : (
        children
      )}
    </AriaTreeItem>
  )
}
