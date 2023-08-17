import {mergeAttributes, Node} from '@tiptap/core'
import {Collaboration} from '@tiptap/extension-collaboration'
import {
  Editor,
  EditorContent,
  FloatingMenu,
  NodeViewWrapper,
  ReactNodeViewRenderer
} from '@tiptap/react'
import {createId, Field, Schema, Type} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {Create} from 'alinea/dashboard/view/Create'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputForm, InputLabel, InputState, useInput} from 'alinea/editor'
import {Card, fromModule, px, TextLabel} from 'alinea/ui'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundNotes} from 'alinea/ui/icons/IcRoundNotes'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react'
import {useEditor} from './hook/UseEditor.js'
import {PickTextLink, usePickTextLink} from './PickTextLink.js'
import {richText as createRichText, RichTextField} from './RichTextField.js'
import css from './RichTextInput.module.scss'
import {RichTextKit} from './RichTextKit.js'
import {RichTextToolbar} from './RichTextToolbar.js'

export * from './RichTextField.js'

export const richText = Field.provideView(RichTextInput, createRichText)

const styles = fromModule(css)

const IsNested = createContext(false)

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
    const meta = Type.meta(type)
    if (!id) return null
    return (
      <NodeViewWrapper>
        <Card.Root style={{margin: `${px(18)} 0`}}>
          <Card.Header>
            <Card.Options>
              <IconButton
                icon={meta.icon || IcRoundDragHandle}
                data-drag-handle
                style={{cursor: 'grab'}}
              />
            </Card.Options>
            <Card.Title>
              <TextLabel label={Type.label(type)} />
            </Card.Title>
            <Card.Options>
              <IconButton icon={IcRoundClose} onClick={deleteNode} />
            </Card.Options>
          </Card.Header>
          <Card.Content>
            <IsNested.Provider value={true}>
              <InputForm state={parent.child(id)} type={type} />
            </IsNested.Provider>
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
  return entries(schema).map(([name, type]) => {
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
  const blocks =
    schema &&
    entries(schema).map(([key, type]) => {
      return (
        <Create.Button
          key={key}
          icon={Type.meta(type).icon}
          onClick={() => {
            onInsert(id, key)
            editor.chain().focus().insertContent({type: key, attrs: {id}}).run()
          }}
        >
          <TextLabel label={Type.label(type)} />
        </Create.Button>
      )
    })
  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{
        zIndex: 4,
        maxWidth: 'none'
      }}
    >
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

function RichTextEditor<Blocks extends Schema>({
  state,
  field
}: RichTextInputProps<Blocks>) {
  const {label, options} = field[Field.Data]
  const picker = usePickTextLink()
  const {optional, inline, help, width, schema} = options
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
    ...schemaToExtensions(state, schema)
  ]
  const isNested = useContext(IsNested)
  const content = useMemo(() => {
    return {
      type: 'doc',
      content: value.map(node => {
        if (node.type === 'text') return node //
        const {type, ...attrs} = node
        if (schema?.[type]) return {type, attrs: {id: (node as any).id}}
        return {
          type,
          content: 'content' in node ? node.content : undefined,
          attrs
        }
      })
    }
  }, [])
  const editor = useEditor(
    {
      content: isNested ? undefined : content,
      onFocus: ({event}) => focusToggle(event.currentTarget),
      onBlur: ({event}) => focusToggle(event.relatedTarget),
      extensions,
      editable: !options.readonly
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
          pickLink={picker.pickLink}
        />
      )}
      <PickTextLink picker={picker} />
      <InputLabel
        label={label}
        help={help}
        optional={optional}
        inline={inline}
        width={width}
        focused={focus}
        icon={IcRoundNotes}
        empty={editor.isEmpty}
        ref={containerRef}
      >
        <InsertMenu editor={editor} schema={schema} onInsert={insert} />
        <EditorContent
          className={styles.root.editor({focus, readonly: options.readonly})}
          editor={editor}
        />
      </InputLabel>
    </>
  )
}

export interface RichTextInputProps<Blocks extends Schema> {
  state: InputState<InputState.Text<Blocks>>
  field: RichTextField<Blocks>
}

export function RichTextInput<Blocks extends Schema>({
  state,
  field
}: RichTextInputProps<Blocks>) {
  const [_, {fragment}] = useInput(state)
  // We key here currently because the tiptap/yjs combination fails to register
  // changes when the fragment is changed while the editor is mounted.
  return <RichTextEditor key={fragment.doc?.guid} state={state} field={field} />
}
