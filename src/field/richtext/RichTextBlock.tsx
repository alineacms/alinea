import {
  Button,
  Kbd,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SortableList,
  SortableListItemTitle,
  SortableListItemTrigger,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListHandle,
  SortableListItemHeader
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {Badge} from '#/components.js'
import {BlockSheet, useBlockSheet} from '#/dashboard/app/BlockSheet.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  IcBaselineContentCopy,
  IcRoundClose,
  IcRoundDelete
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
  const badge = (
    <Badge icon={typeIcon} size="sm">
      {label}
    </Badge>
  )

  return (
    <>
      <SortableList
        className={styles.RichTextBlock()}
        data-depth="muted"
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
              {sheet.available ? (
                <SortableListItemTrigger
                  {...sheet.triggerProps}
                  aria-label={`${label} settings`}
                  aria-expanded={sheet.open}
                  onClick={sheet.toggle}
                >
                  {badge}
                </SortableListItemTrigger>
              ) : (
                badge
              )}
            </SortableListItemTitle>
            <SortableListItemActions>
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
            {badge}
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
