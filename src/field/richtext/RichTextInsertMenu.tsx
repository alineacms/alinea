import {Popover, PopoverContent, PopoverTrigger} from '#/components.js'
import {createId} from '#/core/Id.js'
import type {Schema} from '#/core/Schema.js'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {IcRoundAddCircle} from '#/dashboard/icons.js'
import {
  ListFieldTypeCommand,
  type ListFieldTypeItem
} from '#/field/list/ListField.view.js'
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/core'
import {FloatingMenu} from '@tiptap/react/menus'
import {useMemo, useState} from 'react'
import css from './RichTextInsertMenu.module.css'

const styles = styler(css)

export interface RichTextInsertMenuProps {
  editor: Editor
  schema: Schema
  onInsert: (block: BlockNode) => void
}

export function RichTextInsertMenu({
  editor,
  schema,
  onInsert
}: RichTextInsertMenuProps) {
  const [open, setOpen] = useState(false)
  const items = useMemo<Array<ListFieldTypeItem>>(
    () =>
      entries(schema).map(([id, type]) => ({
        id,
        label: Type.label(type),
        type
      })),
    [schema]
  )
  return (
    <FloatingMenu
      editor={editor}
      className={styles.RichTextInsertMenu()}
      shouldShow={({editor, state}) => {
        const {selection} = state
        return (
          editor.isFocused &&
          selection.empty &&
          selection.$from.depth === 1 &&
          selection.$from.parent.isTextblock &&
          selection.$from.parent.content.size === 0
        )
      }}
    >
      {/* The same picker as the one that adds blocks to a list field */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger variant="ghost" icon={IcRoundAddCircle}>
          Insert block
        </PopoverTrigger>
        <PopoverContent
          aria-label="Insert block"
          align="start"
          className={styles.RichTextInsertMenu.popover()}
        >
          <ListFieldTypeCommand
            items={items}
            label="Insert block"
            onSelect={item => {
              setOpen(false)
              onInsert({
                [Node.type]: item.id,
                [BlockNode.id]: createId(),
                ...Type.initialValue(item.type)
              } as BlockNode)
            }}
          />
        </PopoverContent>
      </Popover>
    </FloatingMenu>
  )
}
