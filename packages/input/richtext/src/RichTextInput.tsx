import {createId, Schema, Type} from '@alinea/core'
import {useReferencePicker} from '@alinea/dashboard'
import {InputForm, InputLabel, InputState, useInput} from '@alinea/editor'
import {Card, Create, fromModule, IconButton, px, TextLabel} from '@alinea/ui'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from '@alinea/ui/icons/IcRoundDragHandle'
import {IcRoundNotes} from '@alinea/ui/icons/IcRoundNotes'
import {mergeAttributes, Node} from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import {
  Editor,
  EditorContent,
  FloatingMenu as TiptapFloatingMenu,
  NodeViewWrapper,
  ReactNodeViewRenderer
} from '@tiptap/react'
import {useCallback, useRef, useState} from 'react'
import {useEditor} from './hook/UseEditor'
import {RichTextField} from './RichTextField'
import css from './RichTextInput.module.scss'
import {RichTextKit} from './RichTextKit'
import {RichTextToolbar} from './RichTextToolbar'

const styles = fromModule(css)

type NodeViewProps = {
  node: {attrs: {id: string}}
  deleteNode: () => void
}

function typeExtension(
  parent: InputState<InputState.Text<any>>,
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
                icon={type.options.icon || IcRoundDragHandle}
                data-drag-handle
                style={{cursor: 'grab'}}
              />
            </Card.Options>
            <Card.Title>
              <TextLabel label={type.label} />
            </Card.Title>
            <Card.Options>
              <IconButton icon={IcRoundClose} onClick={deleteNode} />
            </Card.Options>
          </Card.Header>
          <Card.Content>
            <InputForm state={parent.child(id)} type={type} />
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
  path: InputState<InputState.Text<any>>,
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

// facebook/react#24304
const FloatingMenu: any = TiptapFloatingMenu

function InsertMenu({editor, schema, onInsert}: InsertMenuProps) {
  const id = createId()
  const blocks = Object.entries(schema?.types || {}).map(([key, type]) => {
    return (
      <Create.Button
        key={key}
        icon={type.options.icon}
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
          onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
        >
          H2
        </Create.Button>
        {blocks}
      </Create.Root>
    </FloatingMenu>
  )
}

function RichTextEditor<T>({state, field}: RichTextInputProps<T>) {
  const {pickLink} = useReferencePicker()
  const {blocks, optional, inline, help} = field.options
  const [focus, setFocus] = useState(false)
  const [value, {fragment, insert}] = useInput(state)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLElement>(null)
  const focusToggle = useCallback(
    function focusToggle(target: EventTarget | null) {
      const element = target || document.activeElement
      const editorElement = () =>
        containerRef.current?.querySelector(
          `${styles.root.editor.toSelector()} > .ProseMirror`
        )
      const isFocused =
        toolbarRef.current?.contains(element as HTMLElement) ||
        element === editorElement() ||
        false
      setFocus(isFocused)
    },
    [setFocus]
  )
  const extensions = [
    Collaboration.configure({fragment}),
    RichTextKit,
    ...schemaToExtensions(state, blocks)
  ]
  const editor = useEditor(
    {
      content: {
        type: 'doc',
        content: value.map(node => {
          if (node.type === 'text') return node //
          const {type, ...attrs} = node
          return {
            type,
            content: 'content' in node ? node.content : undefined,
            attrs
          }
        })
      },
      onFocus: ({event}) => focusToggle(event.currentTarget),
      onBlur: ({event}) => focusToggle(event.relatedTarget),
      extensions
    },
    [fragment]
  )
  if (!editor) return null
  return (
    <>
      {focus && (
        <RichTextToolbar
          ref={toolbarRef}
          editor={editor}
          focusToggle={focusToggle}
          pickLink={pickLink}
        />
      )}
      <InputLabel
        label={field.label}
        help={help}
        optional={optional}
        inline={inline}
        focused={focus}
        icon={IcRoundNotes}
        empty={editor.isEmpty}
        ref={containerRef}
      >
        <InsertMenu editor={editor} schema={blocks} onInsert={insert} />
        <EditorContent
          className={styles.root.editor({focus})}
          editor={editor}
        />
      </InputLabel>
    </>
  )
}

export type RichTextInputProps<T> = {
  state: InputState<InputState.Text<T>>
  field: RichTextField<T>
}

export function RichTextInput<T>({state, field}: RichTextInputProps<T>) {
  const [, {fragment}] = useInput(state)
  // We key here currently because the tiptap/yjs combination fails to register
  // changes when the fragment is changed while the editor is mounted.
  return <RichTextEditor key={fragment.doc?.guid} state={state} field={field} />
}
