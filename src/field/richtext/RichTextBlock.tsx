import {
  Badge,
  Button,
  Kbd,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SortableList,
  SortableListHandle,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListItemHeader,
  SortableListItemTitle
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {BlockSheet, useBlockSheet} from '#/dashboard/app/BlockSheet.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  IcBaselineContentCopy,
  IcRoundClose,
  IcRoundDelete,
  IcRoundMoreHoriz
} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {memo, useMemo} from 'react'
import css from './RichTextBlock.module.css'

const styles = styler(css)

export interface RichTextBlockProps {
  id: string
  node: ReactiveNode<object>
  type: Type
  readOnly: boolean
  onDelete: () => void
  onDuplicate: () => void
}

export const RichTextBlock = memo(function RichTextBlock({
  id,
  node,
  type,
  readOnly,
  onDelete,
  onDuplicate
}: RichTextBlockProps) {
  const label = Type.label(type)
  const typeIcon = getType(type).icon
  const sheet = useBlockSheet(id)

  return (
    <>
      <SortableList
        className={styles.RichTextBlock()}
        data-read-only={readOnly || undefined}
        data-richtext-block="true"
      >
        <SortableListItem tabIndex={0} current={sheet.open}>
          <SortableListItemHeader data-richtext-block-header="true">
            {!readOnly && (
              <SortableListHandle
                aria-label={`Drag ${label} block`}
                className={styles.RichTextBlock.dragHandle()}
                data-richtext-drag-handle="true"
                draggable
                onDragStart={event => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData(
                    'application/x-alinea-richtext-block',
                    id
                  )
                }}
              />
            )}
            <SortableListItemTitle>
              <Badge icon={typeIcon}>{label}</Badge>
            </SortableListItemTitle>
            <SortableListItemActions>
              <Button
                variant="ghost"
                aria-label={`${label} settings`}
                aria-expanded={sheet.open}
                active={sheet.open}
                icon={IcRoundMoreHoriz}
                size="icon-sm"
                onClick={sheet.toggle}
              />
              <Button
                variant="ghost"
                aria-label={`Remove ${label}`}
                icon={IcRoundClose}
                disabled={readOnly}
                onClick={onDelete}
                size="icon-sm"
              />
            </SortableListItemActions>
          </SortableListItemHeader>
          <SortableListItemContent data-richtext-block-editor="true">
            {readOnly ? (
              <ReadOnlyBlockEditor node={node} type={type} />
            ) : (
              <NodeEditor node={node} type={type} />
            )}
          </SortableListItemContent>
        </SortableListItem>
      </SortableList>
      <BlockSheet id={id}>
        <SheetContent onClose={() => sheet.setOpen(false)}>
          <SheetHeader>
            <Badge icon={typeIcon} size="sm">
              {label}
            </Badge>
            <SheetTitle>{label}</SheetTitle>
            <Kbd size="sm" aria-hidden>
              Esc
            </Kbd>
            <SheetClose aria-label="Close block settings" />
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              icon={IcBaselineContentCopy}
              disabled={readOnly}
              onClick={() => {
                onDuplicate()
                sheet.setOpen(false)
              }}
            >
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              color="destructive"
              icon={IcRoundDelete}
              disabled={readOnly}
              onClick={onDelete}
            >
              Delete
            </Button>
          </SheetFooter>
        </SheetContent>
      </BlockSheet>
    </>
  )
})

interface ReadOnlyBlockEditorProps {
  node: ReactiveNode<object>
  type: Type
}

function ReadOnlyBlockEditor({node, type}: ReadOnlyBlockEditorProps) {
  const value = useAtomValueRaw(node.value)
  const readOnlyNode = useMemo(
    () => new ReactiveNode<object>(value, true),
    [value]
  )
  return <NodeEditor node={readOnlyNode} type={type} />
}
