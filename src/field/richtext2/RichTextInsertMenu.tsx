import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import type {Schema} from '#/core/Schema.js'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {IcRoundAddCircle} from '#/dashboard/icons.js'
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

export function RichTextInsertMenu({
  editor,
  schema,
  onInsert
}: RichTextInsertMenuProps) {
  return (
    <FloatingMenu
      editor={editor}
      className={styles.RichTextInsertMenu()}
      shouldShow={({editor, state}) => {
        const {selection} = state
        return (
          editor.isFocused &&
          selection.empty &&
          !hasListItemParent(selection.$from) &&
          selection.$from.parent.isTextblock &&
          selection.$from.parent.content.size === 0
        )
      }}
    >
      <Menu
        aria-label="Insert block"
        label={
          <Button appearance="plain">
            <Icon icon={IcRoundAddCircle} />
            Insert block
          </Button>
        }
      >
        {entries(schema).map(([name, type]) => (
          <MenuItem
            key={name}
            id={name}
            textValue={Type.label(type)}
            onAction={() => {
              onInsert({
                [Node.type]: name,
                [BlockNode.id]: createId(),
                ...Type.initialValue(type)
              } as BlockNode)
            }}
          >
            <span className={styles.RichTextInsertMenu.item()}>
              <Icon icon={getType(type).icon ?? IcRoundAddCircle} />
              <span className={styles.RichTextInsertMenu.label()}>
                {Type.label(type)}
              </span>
            </span>
          </MenuItem>
        ))}
      </Menu>
    </FloatingMenu>
  )
}

function hasListItemParent(position: {
  depth: number
  node: (depth: number) => {type: {name: string}}
}): boolean {
  for (let depth = position.depth; depth > 0; depth -= 1)
    if (position.node(depth).type.name === 'listItem') return true
  return false
}
