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
import type {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import styler from '@alinea/styler'
import {memo, useState} from 'react'
import css from './RichTextBlock.module.css'

const styles = styler(css)

export interface RichTextBlockProps {
  node: ReactiveNode<object>
  type: Type
  readOnly: boolean
  onDelete: () => void
  onDuplicate: () => void
}

export const RichTextBlock = memo(function RichTextBlock({
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
          <NodeEditor type={type} node={node} />
        </ListRowBody>
      </ListRow>
    </List>
  )
})
