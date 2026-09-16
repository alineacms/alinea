import {TypeCreateActions, type TypePickerItem} from '#/components.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import type {Schema} from '#/core/Schema.js'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {IcRoundNotes} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/core'
import {FloatingMenu} from '@tiptap/react/menus'
import css from './RichTextInsertMenu.module.css'

const styles = styler(css)

export interface RichTextInsertMenuProps {
  editor: Editor
  schema: Schema
  onInsert: (block: BlockNode) => void
}

interface RichTextTypePickerItem extends TypePickerItem {
  name: string
  type: Schema[string]
}

export function RichTextInsertMenu({
  editor,
  schema,
  onInsert
}: RichTextInsertMenuProps) {
  const items: Array<RichTextTypePickerItem> = entries(schema).map(
    ([name, type]) => ({
      id: name,
      name,
      type,
      label: Type.label(type),
      colorName: Type.label(type),
      icon: getType(type).icon ?? IcRoundNotes
    })
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
      <TypeCreateActions
        items={items}
        label="Insert block"
        onSelect={item => {
          onInsert({
            [Node.type]: item.name,
            [BlockNode.id]: createId(),
            ...Type.initialValue(item.type)
          } as BlockNode)
        }}
      />
    </FloatingMenu>
  )
}
