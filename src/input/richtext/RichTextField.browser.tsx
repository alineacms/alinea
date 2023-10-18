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
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputForm, InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule, HStack, Icon, px, TextLabel} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import IcRoundAddCircle from 'alinea/ui/icons/IcRoundAddCircle'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundNotes} from 'alinea/ui/icons/IcRoundNotes'
import {Sink} from 'alinea/ui/Sink'
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
import css from './RichTextField.module.scss'
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
        <Sink.Root style={{margin: `${px(18)} 0`}}>
          <Sink.Header>
            <Sink.Options>
              <IconButton
                icon={meta.icon || IcRoundDragHandle}
                data-drag-handle
                style={{cursor: 'grab'}}
              />
            </Sink.Options>
            <Sink.Title>
              <TextLabel label={Type.label(type)} />
            </Sink.Title>
            <Sink.Options>
              <IconButton icon={IcRoundClose} onClick={deleteNode} />
            </Sink.Options>
          </Sink.Header>
          <Sink.Content>
            <IsNested.Provider value={true}>
              <InputForm state={parent.child(id)} type={type} />
            </IsNested.Provider>
          </Sink.Content>
        </Sink.Root>
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
  if (!schema) return null
  const blocks = entries(schema).map(([key, type]) => {
    return (
      <DropdownMenu.Item
        key={key}
        onClick={() => {
          onInsert(id, key)
          editor.chain().focus().insertContent({type: key, attrs: {id}}).run()
        }}
      >
        <HStack center gap={8}>
          <Icon icon={Type.meta(type).icon ?? IcRoundAddCircle} />
          <TextLabel label={Type.label(type)} />
        </HStack>
      </DropdownMenu.Item>
    )
  })
  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{
        zIndex: 1,
        maxWidth: 'none'
      }}
    >
      <DropdownMenu.Root bottom>
        <DropdownMenu.Trigger className={styles.insert.trigger()}>
          <Icon icon={IcRoundAddCircle} />
          <span>Insert block</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>{blocks}</DropdownMenu.Items>
      </DropdownMenu.Root>
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
    [setFocus, containerRef, toolbarRef]
  )
  const extensions = [
    Collaboration.configure({fragment}),
    RichTextKit,
    ...schemaToExtensions(state, schema)
  ]
  const isNested = useContext(IsNested)
  // The collaboration extension takes over content syncing after inital content
  // is set. Unfortunately we can't fully utilize it to set the content initally
  // as well because it does not work synchronously causing flickering.
  const content = useMemo(
    () => ({
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
    }),
    []
  )
  const onFocus = useCallback(
    ({event}: {event: Event}) => focusToggle(event.currentTarget),
    [focusToggle]
  )
  const onBlur = useCallback(
    ({event}: {event: FocusEvent}) => focusToggle(event.relatedTarget),
    [focusToggle]
  )
  const editor = useEditor(
    {
      content: isNested ? undefined : content,
      onFocus,
      onBlur,
      extensions,
      editable: !options.readonly
    },
    []
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
  const key = useMemo(createId, [fragment])
  // We key here currently because the tiptap/yjs combination fails to register
  // changes when the fragment is changed while the editor is mounted.
  return <RichTextEditor key={key} state={state} field={field} />
}
