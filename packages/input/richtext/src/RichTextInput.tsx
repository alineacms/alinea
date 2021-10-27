import {createId, InputPath, Schema, TextDoc, Type} from '@alinea/core'
import {Fields, Label, useInput} from '@alinea/editor'
import {Card, fromModule, HStack, IconButton, TextLabel} from '@alinea/ui'
import {mergeAttributes, Node} from '@tiptap/core'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import Collaboration from '@tiptap/extension-collaboration'
import FloatingMenuExtension from '@tiptap/extension-floating-menu'
import {
  BubbleMenu,
  Editor,
  EditorContent,
  FloatingMenu,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {MdDelete, MdDragHandle} from 'react-icons/md/index'
import {RichTextField} from './RichTextField'
import css from './RichTextInput.module.scss'

const styles = fromModule(css)

type NodeViewProps = {
  node: {attrs: {id: string}}
  deleteNode: () => void
}

function typeExtension(
  parent: InputPath<TextDoc<any>>,
  name: string,
  type: Type
) {
  function View({node, deleteNode}: NodeViewProps) {
    const {id} = node.attrs
    if (!id) return null
    return (
      <NodeViewWrapper>
        <Card.Root>
          <HStack gap={10}>
            <Card.Options>
              <IconButton
                icon={MdDragHandle}
                data-drag-handle
                style={{cursor: 'grab'}}
              />
            </Card.Options>
            <Card.Content>
              <Fields
                path={{
                  type: undefined!,
                  location: parent.location.concat(id)
                }}
                type={type}
              />
            </Card.Content>
            <Card.Options>
              <IconButton icon={MdDelete} onClick={deleteNode} />
            </Card.Options>
          </HStack>
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
  path: InputPath<TextDoc<any>>,
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
      <button
        key={key}
        onClick={() => {
          onInsert(id, key)
          editor.chain().focus().insertContent({type: key, attrs: {id}}).run()
        }}
      >
        <TextLabel label={type.label} />
      </button>
    )
  })
  return (
    <FloatingMenu editor={editor}>
      <button
        onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
      >
        H2
      </button>
      {blocks}
    </FloatingMenu>
  )
}

export type RichTextInputProps<T> = {
  path: InputPath<TextDoc<T>>
  field: RichTextField<T>
}

export function RichTextInput<T>({path, field}: RichTextInputProps<T>) {
  const {blocks, optional, help} = field.options
  const [content, {fragment, insert}] = useInput(path)
  const editor = useEditor({
    content,
    extensions: [
      BubbleMenuExtension,
      FloatingMenuExtension,
      Collaboration.configure({fragment}),
      StarterKit.configure({history: false}),
      ...schemaToExtensions(path, blocks)
    ]
  })
  if (!editor) return null
  return (
    <div className={styles.root()}>
      <InsertMenu editor={editor} schema={blocks} onInsert={insert} />
      <BubbleMenu editor={editor}>
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
      </BubbleMenu>
      <Label label={field.label} help={help} optional={optional}>
        <EditorContent className={styles.root.editor()} editor={editor} />
      </Label>
    </div>
  )
}
