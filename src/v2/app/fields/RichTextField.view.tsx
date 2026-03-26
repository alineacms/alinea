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
import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  TextDoc,
  TextNode
} from 'alinea/core/TextDoc'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {extensions as baseExtensions} from 'alinea/field/richtext/Extensions'
import {RichTextOptions} from 'alinea/field/richtext/RichTextField'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useFieldNode, useFieldOptions, useFieldSetter} from 'alinea/v2/store'
import {useStore} from 'jotai'
import {memo, useEffect, useMemo} from 'react'
import {createPortal} from 'react-dom'
import css from './RichTextField.module.css'

const styles = styler(css)

export interface RichTextFieldViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
}

export const RichTextFieldView = memo(function RichTextFieldView<
  Blocks extends Schema
>({field}: RichTextFieldViewProps<Blocks>) {
  const store = useStore()
  const options = useFieldOptions(field)
  const toolbar = document.getElementById('alinea-toolbar')
  const setValue = useFieldSetter(field)
  const content = useMemo(() => {
    // Get the value once, but don't subscribe to updates
    const value = store.get(useFieldNode(field).value) as TextDoc | undefined
    return {
      type: 'doc',
      content: value?.map(toContent) ?? []
    }
  }, [store, field])
  const extensions = useMemo(() => values(baseExtensions), [])
  const editor = useEditor({
    content,
    extensions,
    onUpdate({editor}) {
      setValue(fromContent(editor.getJSON()))
    }
  })
  useEffect(() => {
    console.log('Setting content', content)
    if (editor) editor.commands.setContent(content)
  }, [editor, content])
  return (
    <>
      <Label
        description={options.help}
        isRequired={options.required}
        label={options.label}
      >
        <EditorContent editor={editor} className={styles.root()} />
      </Label>
      {toolbar && createPortal(<RichTextToolbar />, toolbar)}
    </>
  )
})

const RichTextToolbar = memo(function RichTextToolbar() {
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
})

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

function fromContent(content: JSONContent): Array<Node> {
  const nodes = content.content?.flatMap(fromNode) ?? []
  const [first] = nodes
  const isEmptyParagraph =
    nodes.length === 1 &&
    Node.isElement(first) &&
    first[Node.type] === 'paragraph' &&
    first[ElementNode.content]?.length === 0
  return isEmptyParagraph ? [] : nodes
}

function fromNode(content: JSONContent): Array<Node> {
  const {type, text, marks, attrs} = content
  if (!type) return []
  if (type === 'text') {
    const node: Node = {
      [Node.type]: 'text',
      [TextNode.text]: text,
      [TextNode.marks]: marks?.map(fromMark)
    }
    if (!node[TextNode.marks]?.length) delete node[TextNode.marks]
    return [node]
  }
  if (type[0] === type[0].toUpperCase()) {
    return [
      {
        [Node.type]: type,
        [BlockNode.id]: String(attrs?.[BlockNode.id] ?? '')
      }
    ]
  }
  const normalizedAttrs = normalizeNodeAttrs(attrs)
  return [
    {
      [Node.type]: type,
      ...normalizedAttrs,
      [ElementNode.content]: content.content?.flatMap(fromNode)
    }
  ]
}

function fromMark(mark: NonNullable<JSONContent['marks']>[number]): Mark {
  const {type, attrs} = mark
  return {
    [Mark.type]: type,
    ...Object.fromEntries(
      entries(normalizeMarkAttrs(attrs)).map(([key, value]) => {
        if (key.startsWith('data-')) return [`_${key.slice(5)}`, value]
        return [key, value]
      })
    )
  }
}

function normalizeNodeAttrs(
  attrs: Record<string, unknown> | undefined
): Record<string, unknown> {
  return Object.fromEntries(
    entries(attrs ?? {}).filter(
      ([, value]) => value !== null && value !== undefined
    )
  )
}

function normalizeMarkAttrs(attrs: Record<string, unknown> | undefined) {
  return fromEntries(
    entries(attrs ?? {}).filter(([, value]) => typeof value === 'string')
  ) as Record<string, string>
}
