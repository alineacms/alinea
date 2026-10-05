import {
  Button,
  SortableList,
  SortableListItemTitle,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListHandle,
  SortableListItemHeader,
  SortableListItemIcon,
  SortableListItemLabel,
  SortableListItemSettings,
  SortableListItemToggle,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  IcBaselineContentCopy,
  IcOutlineViewList,
  IcRoundClose,
  IcRoundMoreHoriz
} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
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
  const typeIcon = getType(type).icon || IcOutlineViewList
  const [actionsOpen, setActionsOpen] = useState(false)
  const [expanded, setExpanded] = useState(true)

  function closeActions() {
    setActionsOpen(false)
  }

  return (
    <SortableList
      className={styles.RichTextBlock()}
      data-read-only={readOnly || undefined}
      data-richtext-block="true"
    >
      <SortableListItem tabIndex={0}>
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
            <SortableListItemIcon icon={typeIcon} name={label} />
            <SortableListItemLabel>{label}</SortableListItemLabel>
          </SortableListItemTitle>
          {!readOnly && (
            <SortableListItemActions>
              <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                <PopoverTrigger
                  variant="ghost"
                  aria-label={`${label} actions`}
                  icon={IcRoundMoreHoriz}
                  size="icon-sm"
                />
                <PopoverContent
                  aria-label={`${label} actions`}
                  side="bottom"
                  align="end"
                >
                  <SortableListItemSettings variant="actions">
                    <Button
                      variant="ghost"
                      icon={IcBaselineContentCopy}
                      onClick={() => {
                        onDuplicate()
                        closeActions()
                      }}
                    >
                      Duplicate
                    </Button>
                  </SortableListItemSettings>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                aria-label={`Remove ${label}`}
                icon={IcRoundClose}
                onClick={onDelete}
                size="icon-sm"
              />
            </SortableListItemActions>
          )}
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
