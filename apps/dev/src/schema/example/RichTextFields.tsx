import {Config, Field} from 'alinea'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {
  RichTextAlignmentMenu,
  RichTextHeadingMenu,
  RichTextMenuDivider,
  RichTextTableMenu,
  RichTextToolbarProps,
  RichTextToolbarRoot,
  RichTextToolbarSeparator,
  createLinkHandler,
  createToolbarExec
} from 'alinea/field/richtext/RichTextToolbar'
import {HStack, Icon, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {IcRoundFormatBold} from 'alinea/ui/icons/IcRoundFormatBold'
import {IcRoundFormatItalic} from 'alinea/ui/icons/IcRoundFormatItalic'
import {IcRoundFormatListBulleted} from 'alinea/ui/icons/IcRoundFormatListBulleted'
import {IcRoundFormatListNumbered} from 'alinea/ui/icons/IcRoundFormatListNumbered'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {TableInsert} from 'alinea/ui/icons/TableInsert'

function CustomToolbar({
  editor,
  focusToggle,
  pickLink,
  enableTables
}: RichTextToolbarProps) {
  const exec = createToolbarExec(editor)
  const handleLink = createLinkHandler(editor, pickLink, exec)
  return (
    <RichTextToolbarRoot focusToggle={focusToggle}>
      <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
        <RichTextHeadingMenu editor={editor} exec={exec} />
        {enableTables && (
          <RichTextTableMenu editor={editor} exec={exec}>
            <RichTextMenuDivider />
            <DropdownMenu.Item
              onClick={() =>
                exec()
                  .insertTable({rows: 2, cols: 4, withHeaderRow: false})
                  .run()
              }
            >
              <HStack gap={8} center>
                <Icon icon={TableInsert} size={20} />
                Quick 2x4 table
              </HStack>
            </DropdownMenu.Item>
          </RichTextTableMenu>
        )}
        <RichTextToolbarSeparator />
        <IconButton
          icon={IcRoundFormatBold}
          size={18}
          title="Bold"
          onClick={e => {
            e.preventDefault()
            exec().toggleBold().run()
          }}
          active={editor.isActive('bold')}
        />
        <IconButton
          icon={IcRoundFormatItalic}
          size={18}
          title="Italic"
          onClick={e => {
            e.preventDefault()
            exec().toggleItalic().run()
          }}
          active={editor.isActive('italic')}
        />
        <RichTextAlignmentMenu editor={editor} exec={exec} />
        <RichTextToolbarSeparator />
        <IconButton
          icon={IcRoundFormatListBulleted}
          size={18}
          title="Bullet list"
          onClick={e => {
            e.preventDefault()
            exec().toggleBulletList().run()
          }}
          active={editor.isActive('bulletList')}
        />
        <IconButton
          icon={IcRoundFormatListNumbered}
          size={18}
          title="Ordered list"
          onClick={e => {
            e.preventDefault()
            exec().toggleOrderedList().run()
          }}
          active={editor.isActive('orderedList')}
        />
        <RichTextToolbarSeparator />
        <IconButton
          icon={IcRoundLink}
          size={18}
          title="Link"
          onClick={handleLink}
          active={editor.isActive('link')}
        />
      </HStack>
    </RichTextToolbarRoot>
  )
}

export const RichTextFields = Config.document('Rich text fields', {
  fields: {
    withInitial: Field.richText('With initial value', {
      searchable: true,
      required: true,
      initialValue: [
        {
          _type: 'paragraph',
          content: [
            {
              _type: 'text',
              text: 'This is a paragraph with initial value'
            }
          ]
        }
      ]
    }),
    makeRO: Field.check('Make read-only'),
    nested: Field.richText('With nested blocks', {
      searchable: true,
      schema: {
        Inner: Config.type('Inner', {
          fields: {
            checkbox1: Field.check('Checkbox 1'),
            checkbox2: Field.check('Checkbox 2'),
            title: Field.text('Title'),
            content: Field.richText('Inner rich text', {
              searchable: true
            })
          }
        }),

        NestLayout: Config.type('Nested layout fields', {
          fields: {
            object: Field.object('Object field', {
              fields: {
                fieldA: Field.text('Field A', {width: 0.5}),
                fieldB: Field.text('Field B', {width: 0.5})
              }
            }),
            ...Field.tabs(
              Field.tab('Tab A', {
                fields: {tabA: Field.text('Tab A')}
              }),
              Field.tab('Tab B', {
                fields: {tabB: Field.text('Tab B')}
              })
            )
          }
        })
      }
    }),
    table: Field.richText('With table support', {
      enableTables: true,
      toolbarView: CustomToolbar
    })
  }
})
