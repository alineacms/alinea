import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {Schema} from '#/core/Schema.js'
import {BlockNode} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {IcRoundAddCircle} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/core'
import {FloatingMenu} from '@tiptap/react/menus'
import css from './InsertMenu.module.css'
import {richTextBlockAttributes} from './RichTextBlockCodec.js'

const styles = styler(css)

export interface InsertMenuProps {
  editor: Editor
  schema: Schema | undefined
  onInsert: (id: string, type: string) => BlockNode | undefined
  onInserted?: (block: BlockNode | undefined) => void
}

export function InsertMenu({
  editor,
  schema,
  onInsert,
  onInserted
}: InsertMenuProps) {
  if (!schema) return null
  return (
    <FloatingMenu editor={editor} className={styles.InsertMenu.menu()}>
      <Menu
        aria-label="Insert block"
        label={
          <Button appearance="plain" className={styles.InsertMenu.trigger()}>
            <Icon icon={IcRoundAddCircle} />
            <span>Insert block</span>
          </Button>
        }
      >
        {entries(schema).map(([key, type]) => {
          const meta = getType(type)
          const label = Type.label(type)
          return (
            <MenuItem
              key={key}
              id={key}
              textValue={label}
              onAction={() => {
                const id = createId()
                const block = onInsert(id, key)
                const inserted = editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: key,
                    attrs: block
                      ? richTextBlockAttributes(block)
                      : {[BlockNode.id]: id}
                  })
                  .run()
                if (inserted) onInserted?.(block)
              }}
            >
              <span className={styles.InsertMenu.item()}>
                <Icon aria-hidden icon={meta.icon ?? IcRoundAddCircle} />
                <span>{label}</span>
              </span>
            </MenuItem>
          )
        })}
      </Menu>
    </FloatingMenu>
  )
}
