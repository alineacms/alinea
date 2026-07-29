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
  ListRowDragHandle,
  ListRowHeader,
  ListRowSettings,
  ListRowSettingsButton,
  MenuSeparator,
  Popover
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {Badge} from '#/dashboard/app/Badge.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  IcBaselineContentCopy,
  IcRoundClose,
  IcRoundMoreHoriz
} from '#/dashboard/icons.js'
import {ReactiveNode} from '#/dashboard/atoms/entry/editor.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
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
        <ListRowHeader data-richtext-block-header="true" expanded>
          {!readOnly && (
            <ListRowDragHandle
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
          <ListRowDrag>
            <ListRowBadges>
              <Badge icon={typeIcon} size="small">
                {label}
              </Badge>
            </ListRowBadges>
          </ListRowDrag>
          <ListRowActions>
            <DialogTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
              <ListRowSettingsButton
                aria-label={`${label} actions`}
                icon={IcRoundMoreHoriz}
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
                <MenuSeparator />
                <ListRowSettings actions>
                  <Button
                    appearance="plain"
                    isDisabled={readOnly}
                    onPress={() => {
                      onDelete()
                      closeActions()
                    }}
                  >
                    <Icon icon={IcRoundClose} />
                    Delete
                  </Button>
                </ListRowSettings>
              </Popover>
            </DialogTrigger>
          </ListRowActions>
        </ListRowHeader>
        <ListRowBody data-richtext-block-editor="true">
          {readOnly ? (
            <ReadOnlyBlockEditor node={node} type={type} />
          ) : (
            <NodeEditor node={node} type={type} />
          )}
        </ListRowBody>
      </ListRow>
    </List>
  )
})

interface ReadOnlyBlockEditorProps {
  node: ReactiveNode<object>
  type: Type
}

function ReadOnlyBlockEditor({node, type}: ReadOnlyBlockEditorProps) {
  const value = useAtomValue(node.value)
  const readOnlyNode = useMemo(
    () => new ReactiveNode<object>(value, true),
    [value]
  )
  return <NodeEditor node={readOnlyNode} type={type} />
}
