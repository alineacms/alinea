import {
  Button,
  DialogTrigger,
  Icon,
  List,
  ListRow,
  ListRowActions,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowFoldButton,
  ListRowHeader,
  ListRowSettings,
  ListRowType,
  Popover
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/EntryFields.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  IcBaselineContentCopy,
  IcRoundClose,
  IcRoundMoreHoriz,
  IcRoundNotes
} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {memo, useMemo, useState} from 'react'
import css from './RichTextBlock.module.css'

const styles = styler(css)

export interface RichTextBlockProps {
  expanded: boolean
  id: string
  node: ReactiveNode<object>
  type: Type
  readOnly: boolean
  onDelete: () => void
  onDuplicate: () => void
  onToggle: () => void
}

export const RichTextBlock = memo(function RichTextBlock({
  expanded,
  id,
  node,
  type,
  readOnly,
  onDelete,
  onDuplicate,
  onToggle
}: RichTextBlockProps) {
  const label = Type.label(type)
  const typeIcon = getType(type).icon || IcRoundNotes
  const [actionsOpen, setActionsOpen] = useState(false)

  function closeActions() {
    setActionsOpen(false)
  }

  return (
    <List
      className={styles.RichTextBlock()}
      data-depth="muted"
      data-read-only={readOnly || undefined}
      data-richtext-block="true"
    >
      <ListRow role="listitem" tabIndex={0}>
        <ListRowHeader
          aria-label={!readOnly ? `Drag ${label} block` : undefined}
          data-richtext-drag-handle="true"
          data-richtext-block-header="true"
          draggable={!readOnly}
          expanded={expanded}
          onToggle={onToggle}
          onDragStart={event => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(
              'application/x-alinea-richtext-block',
              id
            )
          }}
        >
          <ListRowDrag>
            <ListRowBadges>
              <ListRowFoldButton
                aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
                expanded={expanded}
                onPress={onToggle}
              />
              <ListRowType icon={typeIcon}>{label}</ListRowType>
            </ListRowBadges>
          </ListRowDrag>
          <ListRowActions>
            <DialogTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
              <Button
                appearance="plain"
                aria-label={`${label} actions`}
                icon={IcRoundMoreHoriz}
                size="icon-small"
              />
              <Popover placement="bottom right">
                <ListRowSettings actions>
                  <Button
                    appearance="plain"
                    isDisabled={readOnly}
                    onPress={() => {
                      onDuplicate()
                      closeActions()
                    }}
                  >
                    <Icon icon={IcBaselineContentCopy} />
                    Duplicate
                  </Button>
                </ListRowSettings>
              </Popover>
            </DialogTrigger>
            <Button
              appearance="plain"
              aria-label={`Remove ${label}`}
              icon={IcRoundClose}
              isDisabled={readOnly}
              onPress={onDelete}
              size="icon-small"
            />
          </ListRowActions>
        </ListRowHeader>
        {expanded && (
          <ListRowBody data-richtext-block-editor="true">
            {readOnly ? (
              <ReadOnlyBlockEditor node={node} type={type} />
            ) : (
              <NodeEditor node={node} type={type} />
            )}
          </ListRowBody>
        )}
      </ListRow>
    </List>
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
