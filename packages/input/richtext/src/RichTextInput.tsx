import {createId, Schema, TextDoc, Type} from '@alinea/core'
import {Fields, InputLabel, InputState, useInput} from '@alinea/editor'
import {Card, Create, fromModule, IconButton, px, TextLabel} from '@alinea/ui'
import {mergeAttributes, Node} from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import FloatingMenuExtension from '@tiptap/extension-floating-menu'
import {
  Editor,
  EditorContent,
  FloatingMenu,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {MdDelete, MdDragHandle, MdNotes} from 'react-icons/md'
import {RichTextField} from './RichTextField'
import css from './RichTextInput.module.scss'

const styles = fromModule(css)

type NodeViewProps = {
  node: {attrs: {id: string}}
  deleteNode: () => void
}

function typeExtension(
  parent: InputState<TextDoc<any>>,
  name: string,
  type: Type
) {
  function View({node, deleteNode}: NodeViewProps) {
    const {id} = node.attrs
    if (!id) return null
    return (
      <NodeViewWrapper>
        <Card.Root style={{margin: `${px(18)} 0`}}>
          <Card.Header>
            <Card.Options>
              <IconButton
                icon={MdDragHandle}
                data-drag-handle
                style={{cursor: 'grab'}}
              />
            </Card.Options>
            <Card.Title>
              <TextLabel label={type.label} />
            </Card.Title>
            <Card.Options>
              <IconButton icon={MdDelete} onClick={deleteNode} />
            </Card.Options>
          </Card.Header>
          <Card.Content>
            <Fields state={parent.child(id)} type={type} />
          </Card.Content>
        </Card.Root>
      </NodeViewWrapper>
    )
  }
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    parseHTML() {
      return [{tag: name}]
    },
    renderHTML({HTMLAttributes}) {
      return [name, mergeAttributes(HTMLAttributes)]
    },
    addNodeView() {
      return ReactNodeViewRenderer(View)
    },
    addAttributes() {
      return {
        id: {default: null}
      }
    }
  })
}

function schemaToExtensions(
  path: InputState<TextDoc<any>>,
  schema: Schema | undefined
) {
  if (!schema) return []
  const {types} = schema
  return Object.entries(types).map(([name, type]) => {
    return typeExtension(path, name, type)
  })
}

type InsertMenuProps = {
  editor: Editor
  schema: Schema | undefined
  onInsert: (id: string, type: string) => void
}

function InsertMenu({editor, schema, onInsert}: InsertMenuProps) {
  const id = createId()
  const blocks = Object.entries(schema?.types || {}).map(([key, type]) => {
    return (
      <Create.Button
        key={key}
        onClick={() => {
          onInsert(id, key)
          editor.chain().focus().insertContent({type: key, attrs: {id}}).run()
        }}
      >
        <TextLabel label={type.label} />
      </Create.Button>
    )
  })
  return (
    <FloatingMenu editor={editor}>
      <Create.Root>
        <Create.Button
          onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
        >
          H1
        </Create.Button>
        <Create.Button
          onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
        >
          H2
        </Create.Button>
        {blocks}
      </Create.Root>
    </FloatingMenu>
  )
}

export type RichTextInputProps<T> = {
  state: InputState<TextDoc<T>>
  field: RichTextField<T>
}

export function RichTextInput<T>({state, field}: RichTextInputProps<T>) {
  const {blocks, optional, help} = field.options
  const [content, {fragment, insert}] = useInput(state)
  const editor = useEditor(
    {
      content,
      extensions: [
        // BubbleMenuExtension,
        FloatingMenuExtension,
        Collaboration.configure({fragment}),
        StarterKit.configure({history: false}),
        ...schemaToExtensions(state, blocks)
      ]
    },
    [fragment]
  )
  if (!editor) return null
  return (
    <InputLabel
      label={field.label}
      help={help}
      optional={optional}
      focused={editor.isFocused}
      icon={MdNotes}
      empty={editor.isEmpty}
    >
      <InsertMenu editor={editor} schema={blocks} onInsert={insert} />
      <EditorContent className={styles.root.editor()} editor={editor} />
    </InputLabel>
  )
}

{
  /*<BubbleMenu editor={editor}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
        >
          bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
        >
          italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
        >
          strike
        </button>
  </BubbleMenu>*/
}
