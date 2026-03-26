import {
  Button,
  Icon,
  Label,
  Menu,
  MenuItem,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator
} from '@alinea/components'
import styler from '@alinea/styler'
import {EditorContent, JSONContent, useEditor} from '@tiptap/react'
import {RichTextField as CoreRichTextField} from 'alinea/core/field/RichTextField'
import {Schema} from 'alinea/core/Schema'
import {BlockNode, ElementNode, Mark, Node, TextNode} from 'alinea/core/TextDoc'
import {entries, values} from 'alinea/core/util/Objects'
import {extensions as baseExtensions} from 'alinea/field/richtext/Extensions'
import {RichTextOptions} from 'alinea/field/richtext/RichTextField'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useFieldOptions, useFieldValue} from 'alinea/v2/store'
import {memo} from 'react'
import {createPortal} from 'react-dom'
import css from './RichTextField.module.css'

const styles = styler(css)

export interface RichTextFieldViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
}

export const RichTextFieldView = memo(function RichTextFieldView<
  Blocks extends Schema
>({field}: RichTextFieldViewProps<Blocks>) {
  const options = useFieldOptions(field)
  const toolbar = document.getElementById('alinea-toolbar')
  const [value, setValue] = useFieldValue(field)
  const content = value?.map(toContent)
  console.log('content', content)
  const editor = useEditor({
    content: content,
    extensions: values(baseExtensions)
  })
  return (
    <>
      <Label
        description={options.help}
        isRequired={options.required}
        label={options.label}
      >
        <EditorContent editor={editor} />
      </Label>
      {toolbar && createPortal(<RichTextToolbar />, toolbar)}
    </>
  )
})

function RichTextToolbar() {
  return (
    <Toolbar aria-label="Text formatting" data-orientation="horizontal">
      <ToolbarGroup>
        <Menu
          label={
            <Button appearance="plain">
              Options...
              <IcRoundUnfoldMore />
            </Button>
          }
        >
          <MenuItem>
            <IcRoundUnfoldMore />
            Undo
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Redo
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Insert Link
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Insert Image
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Insert Grid
          </MenuItem>
        </Menu>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <Button
          size="square-petite"
          appearance="plain"
          data-appearance="active"
        >
          <Icon icon={IcRoundUnfoldMore} />
        </Button>

        <Menu
          label={
            <Button size="large" appearance="plain">
              <Icon icon={IcRoundUnfoldMore} />
              <Icon icon={IcRoundUnfoldMore} />
            </Button>
          }
        >
          <MenuItem>
            <IcRoundUnfoldMore />
            Undo
          </MenuItem>
        </Menu>
      </ToolbarGroup>
    </Toolbar>
  )
}

function toContent(node: Node): JSONContent {
  if (Node.isText(node))
    return {
      type: 'text',
      text: node[TextNode.text],
      marks: node[TextNode.marks]?.map(mark => {
        const {[Mark.type]: type, ...attrs} = mark
        const res = Object.fromEntries(
          entries(attrs).map(([key, value]) => {
            if (key.startsWith('_')) return [`data-${key.slice(1)}`, value]
            return [key, value]
          })
        )
        return {type, attrs: res}
      })
    }
  if (Node.isElement(node)) {
    const {[Node.type]: type, [ElementNode.content]: content, ...attrs} = node
    return {type, content: content?.map(toContent), attrs}
  }
  if (Node.isBlock(node)) {
    const {[Node.type]: type} = node
    return {type, attrs: {[BlockNode.id]: node[BlockNode.id]}}
  }
  throw new TypeError('Invalid node')
}
