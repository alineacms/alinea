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
  SortableListItemHeader,
  SortableListItemDescription,
  SortableListItemToggle,
  TextField,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {slugify} from '#/core/util/Slugs.js'
import {Badge} from '#/components.js'
import {BlockTabs} from '#/dashboard/app/BlockTabs.js'
import {BlockSheet, useBlockSheet} from '#/dashboard/app/BlockSheet.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {useEntry} from '#/dashboard/hooks.js'
import {
  IcBaselineContentCopy,
  IcRoundClose,
  IcRoundDelete,
  IcRoundLink
} from '#/dashboard/icons.js'
import {SlugField} from '#/field/path/SlugField.js'
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
  /** Called as the header starts a drag, before the editor handles it */
  onDragStart: () => void
}

export const RichTextBlock = memo(function RichTextBlock({
  id,
  node,
  type,
  readOnly,
  onDelete,
  onDuplicate,
  onDragStart
}: RichTextBlockProps) {
  const label = Type.label(type)
  const typeIcon = getType(type).icon
  const sheet = useBlockSheet(id)
  const [expanded, setExpanded] = useState(true)
  const customLabel =
    (useAtomValueRaw(node.field('_label')) as string | undefined) ?? ''
  const setCustomLabel = useSetAtom(node.field('_label'))
  const anchor = useAtomValueRaw(node.field('_anchor')) as string | undefined
  const setAnchor = useSetAtom(node.field('_anchor'))
  const entryUrl = useEntry()?.url
  const displayLabel = customLabel.trim()
  const displayAnchor = (anchor ?? slugify(displayLabel)).trim()
  const link =
    entryUrl && displayAnchor ? `${entryUrl}#${displayAnchor}` : undefined

  // The anchor follows the label until it is changed by hand, like list rows
  function updateCustomLabel(nextValue: string) {
    setCustomLabel(nextValue || undefined)
    if (anchor === undefined || anchor === slugify(customLabel))
      setAnchor(slugify(nextValue) || undefined)
  }

  function updateAnchor(nextValue: string) {
    setAnchor(slugify(nextValue.replace(/^#+/, '')) || undefined)
  }
  const badge = (
    <Badge icon={typeIcon} size="sm" color="primary">
      {label}
    </Badge>
  )
  const title = (
    <>
      {badge}
      {displayLabel ? (
        <SortableListItemDescription>
          {displayLabel}
        </SortableListItemDescription>
      ) : (
        displayAnchor && <Badge size="sm">#{displayAnchor}</Badge>
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
          <SortableListItemHeader
            className={styles.RichTextBlock.header()}
            data-richtext-block-header="true"
            // The editor moves blocks, dragging the header drags the block
            data-richtext-drag-handle={readOnly ? undefined : 'true'}
            draggable={!readOnly}
            onDragStartCapture={onDragStart}
            onDragStart={event => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData(
                'application/x-alinea-richtext-block',
                id
              )
            }}
          >
            <SortableListItemTitle>
              {/* Browsers only drag from a button that is draggable itself */}
              <SortableListItemToggle
                draggable={!readOnly}
                aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
                expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              />
              {sheet.available ? (
                <SortableListItemTrigger
                  {...sheet.triggerProps}
                  draggable={!readOnly}
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
            <SheetTitle>
              {displayLabel || (displayAnchor && `#${displayAnchor}`) || label}
            </SheetTitle>
            <SheetClose aria-label="Close block settings" />
          </SheetHeader>
          <SheetBody>
            <SheetSection>
              <TextField
                label="Label"
                disabled={readOnly}
                onValueChange={updateCustomLabel}
                value={customLabel}
              />
              <div className={styles.RichTextBlock.anchor()}>
                <div className={styles.RichTextBlock.anchor.field()}>
                  <SlugField
                    fieldValue={anchor}
                    label="Anchor"
                    isDisabled={readOnly}
                    onChange={updateAnchor}
                    source={customLabel}
                  />
                </div>
                {link && (
                  <Tooltip>
                    <TooltipTrigger
                      variant="ghost"
                      size="icon"
                      icon={IcRoundLink}
                      aria-label="Copy link to block"
                      onClick={() => navigator.clipboard.writeText(link)}
                    />
                    <TooltipContent>Copy link to block</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </SheetSection>
            <BlockTabs node={node} type={type} readOnly={readOnly} />
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
