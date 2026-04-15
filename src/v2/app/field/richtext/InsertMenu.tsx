import {Button, Icon, Menu, MenuItem} from '@alinea/components'
import styler from '@alinea/styler'
import {Editor, FloatingMenu} from '@tiptap/react'
import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {Schema} from '#/core/Schema.js'
import {BlockNode} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {IcRoundAddCircle} from '../../../icons.js'
import css from './InsertMenu.module.css'

const styles = styler(css)

export interface InsertMenuProps {
  editor: Editor
  schema: Schema | undefined
  onInsert: (id: string, type: string) => void
}

export function InsertMenu({editor, schema, onInsert}: InsertMenuProps) {
  if (!schema) return null
  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{
        zIndex: 1,
        maxWidth: 'none'
      }}
    >
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
                onInsert(id, key)
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: key,
                    attrs: {[BlockNode.id]: id}
                  })
                  .run()
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
