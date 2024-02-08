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
import {RichTextField} from 'alinea/core/field/RichTextField'
import {entries} from 'alinea/core/util/Objects'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField, useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule, HStack, Icon, px, TextLabel} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {useNonInitialEffect} from 'alinea/ui/hook/UseNonInitialEffect'
import IcRoundAddCircle from 'alinea/ui/icons/IcRoundAddCircle'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from 'alinea/ui/icons/IcRoundDragHandle'
import {IcRoundNotes} from 'alinea/ui/icons/IcRoundNotes'
import {Sink} from 'alinea/ui/Sink'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {PickTextLink, usePickTextLink} from './PickTextLink.js'
import {richText as createRichText, RichTextOptions} from './RichTextField.js'
import css from './RichTextField.module.scss'
import {RichTextKit} from './RichTextKit.js'
import {RichTextToolbar} from './RichTextToolbar.js'

export * from './RichTextField.js'

export const richText = Field.provideView(RichTextInput, createRichText)

const styles = fromModule(css)

type NodeViewProps = {
  node: {attrs: {id: string}}
  deleteNode: () => void
}

function typeExtension(field: Field, name: string, type: Type) {
  function View({node, deleteNode}: NodeViewProps) {
    const {id} = node.attrs
    const meta = Type.meta(type)
    const {readOnly} = useFieldOptions(field)
    return (
      <FormRow field={field} type={type} rowId={id} readOnly={readOnly}>
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
              <InputForm type={type} />
            </Sink.Content>
          </Sink.Root>
        </NodeViewWrapper>
      </FormRow>
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

function schemaToExtensions(field: Field, schema: Schema | undefined) {
  if (!schema) return []
  return entries(schema).map(([name, type]) => {
    return typeExtension(field, name, type)
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

export interface RichTextInputProps<Blocks extends Schema> {
  field: RichTextField<Blocks, RichTextOptions<Blocks>>
}

export function RichTextInput<Blocks extends Schema>({
  field
}: RichTextInputProps<Blocks>) {
  const {value, mutator, options, error} = useField(field)
  const {fragment, insert} = mutator
  const picker = usePickTextLink()
  const {readOnly, schema} = options
  const [focus, setFocus] = useState(false)
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
  const blocks = useMemo(() => {
    return schemaToExtensions(field, schema)
  }, [field, schema])
  const extensions = useMemo(
    () => [Collaboration.configure({fragment}), RichTextKit, ...blocks],
    [fragment, blocks]
  )
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
    [fragment]
  )
  const onFocus = useCallback(
    ({event}: {event: Event}) => focusToggle(event.currentTarget),
    [focusToggle]
  )
  const onBlur = useCallback(
    ({event}: {event: FocusEvent}) => focusToggle(event.relatedTarget),
    [focusToggle]
  )
  const isEditable = !options.readOnly && !readOnly
  const editor = useMemo(() => {
    const doc = fragment.doc!
    let editor
    // The y-prosemirror plugin sometimes mutates the doc during setup
    // which we want to catch because the mutations do not mean a value change
    doc.transact(() => {
      editor = new Editor({
        content,
        onFocus,
        onBlur,
        extensions,
        editable: isEditable
      })
    }, 'self')
    return editor!
  }, [fragment])
  useNonInitialEffect(() => {
    editor.setOptions({editable: isEditable})
  }, [isEditable])
  useEffect(() => {
    return () => editor.destroy()
  }, [editor])
  return (
    <>
      {isEditable && focus && (
        <RichTextToolbar
          ref={toolbarRef}
          editor={editor}
          focusToggle={focusToggle}
          pickLink={picker.pickLink}
        />
      )}
      <PickTextLink picker={picker} />
      <InputLabel
        {...options}
        focused={focus}
        icon={IcRoundNotes}
        empty={editor.isEmpty}
        ref={containerRef}
        error={error}
      >
        <InsertMenu editor={editor} schema={schema} onInsert={insert} />

        <EditorContent
          className={styles.root.editor({focus, readonly: options.readOnly})}
          editor={editor}
        />
      </InputLabel>
    </>
  )
}
