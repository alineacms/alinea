import {useRef, useState} from 'react'
import {
  type DragAndDropHooks,
  DropIndicator,
  type DropItem,
  type DropTarget as AriaDropTarget,
  useDragAndDrop
} from 'react-aria-components'
import type {DragDropProps, DropTarget, Key} from '../types.js'

export interface UseDragDropOptions extends DragDropProps {
  /** Class name of the line drawn between items while reordering */
  dropIndicatorClassName?: (active: boolean) => string
  /** The data-slot of the drop indicator */
  dropIndicatorSlot?: string
}

export interface UseDragDropResult<T extends object> {
  /** Pass to the react-aria collection, undefined when drag and drop is off */
  dragAndDropHooks: DragAndDropHooks<T> | undefined
  /**
   * react-aria cannot add drag and drop hooks to a mounted collection, use
   * this as the collection key so it remounts when they are first enabled
   */
  key: string
}

/**
 * Converts our declarative `DragDropProps` into react-aria drag and drop
 * hooks for Tree, ContentTable and ContentGrid.
 */
export function useDragDrop<T extends object = object>({
  getDragData,
  acceptedDragTypes,
  canDrop,
  onReorder,
  onMove,
  onDropItems,
  onDropFiles,
  renderDragPreview,
  dropIndicatorClassName,
  dropIndicatorSlot
}: UseDragDropOptions): UseDragDropResult<T> {
  const draggable = Boolean(getDragData)
  const droppable = Boolean(onReorder || onMove || onDropItems || onDropFiles)
  // Once enabled we keep the hooks and remount the collection when that
  // happens, see UseDragDropResult.key
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
  const {dragAndDropHooks} = useDragAndDrop<T>({
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
        return allowedOperations.includes('copy')
          ? 'copy'
          : allowedOperations[0]
      }
      const position = target.dropPosition
      const accepts = internal
        ? position === 'on'
          ? Boolean(onMove) && !internal.has(target.key)
          : Boolean(onReorder)
        : Boolean(onDropItems || onDropFiles)
      if (!accepts) return 'cancel'
      if (canDrop && !canDrop(dropTarget(target)!, types)) return 'cancel'
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
    renderDragPreview: renderDragPreview
      ? items => <>{renderDragPreview(items)}</>
      : undefined,
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          data-slot={dropIndicatorSlot}
          className={({isDropTarget}) =>
            dropIndicatorClassName?.(isDropTarget) ?? ''
          }
        />
      )
    }
  })
  return {
    dragAndDropHooks:
      dnd.draggable || dnd.droppable ? dragAndDropHooks : undefined,
    key: `${dnd.draggable}-${dnd.droppable}`
  }
}

function dropTarget(target: AriaDropTarget): DropTarget | undefined {
  if (target.type === 'root') return undefined
  return {key: target.key, position: target.dropPosition}
}
