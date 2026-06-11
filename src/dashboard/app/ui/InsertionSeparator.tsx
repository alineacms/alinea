import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {useRef} from 'react'
import {
  type DropItem,
  useDrop
} from 'react-aria'
import css from './InsertionSeparator.module.css'

const styles = styler(css)

export interface InsertionSeparatorProps {
  children?: ReactNode
  controlOpen?: boolean
  dragType: string
  label: string
  placement?: 'between' | 'edge'
  position: 'before' | 'after'
  readOnly: boolean
  targetIndex?: number
  onMoveRow?: (rowId: string, targetIndex: number) => void
}

export function InsertionSeparator({
  children,
  controlOpen,
  dragType,
  label,
  placement = 'between',
  position,
  readOnly,
  targetIndex,
  onMoveRow
}: InsertionSeparatorProps) {
  const separatorRef = useRef<HTMLDivElement>(null)
  const {dropProps, isDropTarget} = useDrop({
    ref: separatorRef,
    isDisabled:
      readOnly || onMoveRow === undefined || targetIndex === undefined,
    getDropOperation(types, allowedOperations) {
      if (!types.has(dragType)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    },
    async onDrop(event) {
      const rowId = await getDraggedRowId(event.items, dragType)
      if (!rowId || targetIndex === undefined || !onMoveRow) return
      onMoveRow(rowId, targetIndex)
    }
  })
  return (
    <div
      {...dropProps}
      aria-label={`Move ${label} ${position}`}
      className={styles.InsertionSeparator()}
      data-control={children ? undefined : 'false'}
      data-control-open={controlOpen || undefined}
      data-drop-target={isDropTarget || undefined}
      data-placement={placement}
      ref={separatorRef}
    >
      {children && (
        <div className={styles.InsertionSeparator.control()}>{children}</div>
      )}
    </div>
  )
}

async function getDraggedRowId(
  items: Array<DropItem>,
  dragType: string
): Promise<string | null> {
  for (const item of items) {
    if (item.kind === 'text' && item.types.has(dragType) && item.getText) {
      return item.getText(dragType)
    }
  }
  return null
}
