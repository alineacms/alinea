import styler from '@alinea/styler'
import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
  useRef,
  useState
} from 'react'
import {
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
  Button,
  Collection,
  DropIndicator,
  type DropItem,
  type DropTarget as AriaDropTarget,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import {SelectionCheckbox} from './internal/SelectionCheckbox.js'
import css from './Tree.module.css'
import type {
  AriaProps,
  DataProps,
  DragDropProps,
  DropTarget,
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
  ref,
  ...props
}: TreeProps<T>) {
  const draggable = Boolean(getDragData)
  const droppable = Boolean(onReorder || onMove || onDropItems || onDropFiles)
  // react-aria cannot add or remove drag and drop hooks on a mounted tree,
  // once enabled we keep them and remount the tree when that happens
  const [dnd, setDnd] = useState({draggable, droppable})
  if ((draggable && !dnd.draggable) || (droppable && !dnd.droppable))
    setDnd({
      draggable: draggable || dnd.draggable,
      droppable: droppable || dnd.droppable
    })
  const dragging = useRef<ReadonlySet<Key> | null>(null)
  async function drop(items: Array<DropItem>, target?: DropTarget) {
    const data: Array<Record<string, string>> = []
    const files: Array<File> = []
    for (const item of items) {
      if (item.kind === 'file') files.push(await item.getFile())
      if (item.kind !== 'text') continue
      const record: Record<string, string> = {}
      for (const type of item.types) record[type] = await item.getText(type)
      data.push(record)
    }
    if (target && data.length > 0) onDropItems?.({items: data, target})
    if (files.length > 0) onDropFiles?.({files, target})
  }
  const {dragAndDropHooks} = useDragAndDrop({
    isDisabled: !draggable && !droppable,
    acceptedDragTypes,
    getItems: dnd.draggable ? keys => getDragData?.(keys) ?? [] : undefined,
    onDragStart: event => {
      dragging.current = event.keys
    },
    onDragEnd: () => {
      dragging.current = null
    },
    getDropOperation(target, types, allowedOperations) {
      const internal = dragging.current
      if (target.type === 'root') {
        if (internal || !onDropFiles) return 'cancel'
      } else {
        const position = target.dropPosition
        const accepts = internal
          ? position === 'on'
            ? Boolean(onMove) && !internal.has(target.key)
            : Boolean(onReorder)
          : Boolean(onDropItems || onDropFiles)
        if (!accepts) return 'cancel'
        if (canDrop && !canDrop(dropTarget(target)!, types)) return 'cancel'
      }
      return allowedOperations.includes('move') ? 'move' : allowedOperations[0]
    },
    ...(dnd.droppable && {
      onMove(event) {
        const target = dropTarget(event.target)!
        const move = {keys: event.keys, target}
        if (target.position === 'on') onMove?.(move)
        else onReorder?.(move)
      },
      onInsert(event) {
        return drop(event.items, dropTarget(event.target))
      },
      onItemDrop(event) {
        if (event.isInternal) return
        return drop(event.items, dropTarget(event.target))
      },
      onRootDrop(event) {
        return drop(event.items)
      }
    }),
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          data-slot="tree-drop-indicator"
          className={({isDropTarget}) =>
            styles.TreeDropIndicator({active: isDropTarget})
          }
        />
      )
    }
  })
  const tree = (
    <AriaTree
      {...props}
      key={`${dnd.draggable}-${dnd.droppable}`}
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
      dragAndDropHooks={
        dnd.draggable || dnd.droppable ? dragAndDropHooks : undefined
      }
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

function dropTarget(target: AriaDropTarget): DropTarget | undefined {
  if (target.type === 'root') return undefined
  return {key: target.key, position: target.dropPosition}
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
      className={({isDragging, isDropTarget, allowsDragging}) =>
        styles.TreeItem(
          {dragging: isDragging, dropTarget: isDropTarget, allowsDragging},
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
