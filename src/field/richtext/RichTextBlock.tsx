import {
  Button,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  SortableList,
  SortableListItemTitle,
  SortableListItemTrigger,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListHandle,
  SortableListItemHeader,
  SortableListItemDescription,
  SortableListItemToggle,
  TextField
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
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {memo, useMemo, useState} from 'react'
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
  const [expanded, setExpanded] = useState(true)
  const customLabel =
    (useAtomValueRaw(node.field('_label')) as string | undefined) ?? ''
  const setCustomLabel = useSetAtom(node.field('_label'))
  const displayLabel = customLabel.trim()
  const badge = (
    <Badge icon={typeIcon} size="sm" color="primary">
      {label}
    </Badge>
  )
  const title = (
    <>
      {badge}
      {displayLabel && (
        <SortableListItemDescription>
          {displayLabel}
        </SortableListItemDescription>
      )}
    </>
  )

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
              <SortableListItemToggle
                aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
                expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              />
              {sheet.available ? (
                <SortableListItemTrigger
                  {...sheet.triggerProps}
                  aria-label={`${label} settings`}
                  aria-expanded={sheet.open}
                  onClick={() => {
                    // Opening the settings shows the block they belong to
                    if (!sheet.open) setExpanded(true)
                    sheet.toggle()
                  }}
                >
                  {title}
                </SortableListItemTrigger>
              ) : (
                title
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
          {expanded && (
            <SortableListItemContent data-richtext-block-editor="true">
              {readOnly ? (
                <ReadOnlyBlockEditor node={node} type={type} />
              ) : (
                <NodeEditor node={node} type={type} />
              )}
            </SortableListItemContent>
          )}
        </SortableListItem>
      </SortableList>
      <BlockSheet id={id}>
        <SheetContent onClose={() => sheet.setOpen(false)}>
          <SheetHeader>
            {badge}
            <SheetTitle>{displayLabel || label}</SheetTitle>
            <SheetClose aria-label="Close block settings" />
          </SheetHeader>
          <SheetBody>
            <SheetSection>
              <TextField
                label="Label"
                disabled={readOnly}
                onValueChange={value => setCustomLabel(value || undefined)}
                value={customLabel}
              />
            </SheetSection>
          </SheetBody>
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
          </SheetFooter>
          <SheetFooter>
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
