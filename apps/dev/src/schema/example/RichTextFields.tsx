import {Config, Field} from 'alinea'
import {
  RichTextAlignmentMenu,
  RichTextBoldButton,
  RichTextBulletListButton,
  RichTextClearFormattingButton,
  RichTextHeadingMenu,
  RichTextItalicButton,
  RichTextLinkButton,
  RichTextMenuDivider,
  RichTextOrderedListButton,
  RichTextSmallButton,
  RichTextSubscriptButton,
  RichTextSuperscriptButton,
  RichTextTableMenu,
  type RichTextToolbarProps,
  RichTextToolbarRoot,
  RichTextToolbarSeparator,
  useToolbar
} from 'alinea/field/richtext/RichTextToolbar'
import {HStack, Icon, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {TableInsert} from 'alinea/ui/icons/TableInsert'

function CustomToolbar(_props: RichTextToolbarProps) {
  const {enableTables, exec} = useToolbar()
  return (
    <RichTextToolbarRoot>
      <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
        <RichTextHeadingMenu />
        {enableTables && (
          <RichTextTableMenu>
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
        <RichTextBoldButton />
        <RichTextItalicButton />
        <RichTextAlignmentMenu />
        <RichTextClearFormattingButton />
        <RichTextToolbarSeparator />
        <RichTextBulletListButton />
        <RichTextOrderedListButton />
        <RichTextToolbarSeparator />
        <RichTextLinkButton />
        <RichTextToolbarSeparator />
        <RichTextSmallButton />
        <RichTextSubscriptButton />
        <RichTextSuperscriptButton />
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
