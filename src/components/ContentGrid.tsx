import styler from '@alinea/styler'
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo
} from 'react'
import {
  Button as ButtonPrimitive,
  GridLayout,
  GridList,
  GridListItem,
  Size,
  Virtualizer
} from 'react-aria-components'
import css from './ContentGrid.module.css'
import {SelectionCheckbox} from './internal/SelectionCheckbox.js'
import {useDragDrop} from './internal/useDragDrop.js'
import type {
  AriaProps,
  DataProps,
  DragDropProps,
  Key,
  SelectionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface ContentGridProps<T extends object>
  extends StyleProps, AriaProps, SelectionProps, DragDropProps {
  items: Iterable<T>
  /**
   * How pointer clicks select cards. With `toggle` (the default) a click runs
   * the card action, or toggles its selection while cards are selected. With
   * `replace` a click selects only that card and a double click or Enter runs
   * the card action.
   */
  selectionBehavior?: 'toggle' | 'replace'
  /** Show a selection checkbox per card, defaults to multiple selection */
  showSelectionControls?: boolean
  /** Minimum card width in pixels, defaults to 240 */
  minItemWidth?: number
  /** Maximum card width in pixels, defaults to 320 */
  maxItemWidth?: number
  /** Card height in pixels, defaults to 196 */
  itemHeight?: number
  /** Space between cards in pixels, defaults to 16 */
  gap?: number
  /** Defaults to 5 */
  maxColumns?: number
  /**
   * Called when a card is activated (see `selectionBehavior`), cards can
   * override it with their own `onAction`
   */
  onItemAction?: (key: Key) => void
  renderEmptyState?: () => ReactNode
  /** Shown over the grid while files are dragged onto it */
  dropLabel?: string
  /**
   * Cards are cached per item, list the values `children` reads besides the
   * item to render them again when those change
   */
  dependencies?: ReadonlyArray<unknown>
  children: (item: T) => ReactElement
}

interface ContentGridContextValue {
  showSelectionControls: boolean
}

const ContentGridContext = createContext<ContentGridContextValue>({
  showSelectionControls: false
})

export function ContentGrid<T extends object>({
  items,
  selectionMode = 'none',
  selectionBehavior = 'toggle',
  showSelectionControls,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disabledKeys,
  minItemWidth = 240,
  maxItemWidth = 320,
  itemHeight = 196,
  gap = 16,
  maxColumns = 5,
  onItemAction,
  renderEmptyState,
  dropLabel,
  dependencies = [],
  getDragData,
  acceptedDragTypes,
  canDrop,
  onReorder,
  onMove,
  onDropItems,
  onDropFiles,
  renderDragPreview,
  className,
  style,
  children,
  ...props
}: ContentGridProps<T>) {
  const context = useMemo(
    () => ({
      showSelectionControls:
        selectionMode !== 'none' &&
        (showSelectionControls ?? selectionMode === 'multiple')
    }),
    [selectionMode, showSelectionControls]
  )
  const layoutOptions = useMemo(
    () => ({
      minItemSize: new Size(minItemWidth, itemHeight),
      maxItemSize: new Size(maxItemWidth, itemHeight),
      minSpace: new Size(gap, gap),
      maxColumns,
      preserveAspectRatio: true
    }),
    [minItemWidth, maxItemWidth, itemHeight, gap, maxColumns]
  )
  const dnd = useDragDrop<T>({
    getDragData,
    acceptedDragTypes,
    canDrop,
    onReorder,
    onMove,
    onDropItems,
    onDropFiles,
    renderDragPreview,
    dropIndicatorSlot: 'content-grid-drop-indicator',
    dropIndicatorClassName: active => styles.ContentGridDropIndicator({active})
  })
  return (
    <ContentGridContext.Provider value={context}>
      <div
        data-slot="content-grid"
        data-drop-label={dropLabel}
        className={styles.ContentGrid(styler.merge({className}))}
        style={{
          ...style,
          ['--alinea-content-grid-item-height' as string]: `${itemHeight}px`
        }}
      >
        <Virtualizer layout={GridLayout} layoutOptions={layoutOptions}>
          <GridList
            {...props}
            key={dnd.key}
            items={items}
            layout="grid"
            dependencies={[context, ...dependencies]}
            selectionMode={selectionMode}
            selectionBehavior={selectionBehavior}
            selectedKeys={selectedKeys}
            defaultSelectedKeys={defaultSelectedKeys}
            onSelectionChange={onSelectionChange}
            disabledKeys={disabledKeys}
            disabledBehavior="selection"
            onAction={onItemAction}
            dragAndDropHooks={dnd.dragAndDropHooks}
            renderEmptyState={
              renderEmptyState
                ? () => (
                    <div
                      data-slot="content-grid-empty"
                      className={styles.ContentGrid.empty()}
                    >
                      {renderEmptyState()}
                    </div>
                  )
                : undefined
            }
            className={({isDropTarget}) =>
              styles.ContentGrid.list({dropTarget: isDropTarget})
            }
          >
            {children}
          </GridList>
        </Virtualizer>
      </div>
    </ContentGridContext.Provider>
  )
}

export interface ContentGridItemProps extends DataProps {
  id: Key
  /** Text used for typeahead and as the accessible card name */
  textValue: string
  /** Set to false to disable selecting the card, its action still runs */
  selectable?: boolean
  /** Called when the card is activated, overrides `onItemAction` */
  onAction?: () => void
  /**
   * Called on every click or tap of the card, next to its selection. Use it
   * instead of `onAction` to act on a single click with the `replace`
   * selection behavior.
   */
  onPress?: () => void
  onDoubleClick?: () => void
  /** The card contents, typically a ContentCard */
  children: ReactNode
}

export function ContentGridItem({
  id,
  textValue,
  selectable = true,
  onAction,
  onPress,
  onDoubleClick,
  children,
  ...props
}: ContentGridItemProps) {
  const {showSelectionControls} = useContext(ContentGridContext)
  return (
    <GridListItem
      data-slot="content-grid-item"
      {...props}
      id={id}
      textValue={textValue}
      isDisabled={!selectable}
      data-unselectable={!selectable || undefined}
      onAction={onAction}
      onPress={onPress}
      onDoubleClick={onDoubleClick}
      className={({isDropTarget, isDragging}) =>
        styles.ContentGridItem({dropTarget: isDropTarget, dragging: isDragging})
      }
    >
      {({allowsDragging}) => (
        <>
          {showSelectionControls && selectable && (
            <div className={styles.ContentGridItem.checkbox()}>
              <SelectionCheckbox aria-label={`Select ${textValue}`} />
            </div>
          )}
          {allowsDragging && (
            <ButtonPrimitive
              slot="drag"
              data-slot="content-grid-item-drag-handle"
              aria-label={`Drag ${textValue}`}
              className={styles.ContentGridItem.drag()}
            />
          )}
          <div
            data-slot="content-grid-item-card"
            className={styles.ContentGridItem.card()}
          >
            {children}
          </div>
        </>
      )}
    </GridListItem>
  )
}
