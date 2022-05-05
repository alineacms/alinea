import {createId, Schema, Type} from '@alinea/core'
import {Toolbar} from '@alinea/dashboard'
import {InputForm, InputLabel, InputState, useInput} from '@alinea/editor'
import {
  Card,
  Create,
  DropdownMenu,
  fromModule,
  HStack,
  Icon,
  IconButton,
  px,
  TextLabel,
  Typo
} from '@alinea/ui'
import IcAlignCenter from '@alinea/ui/icons/IcAlignCenter'
import IcAlignJustify from '@alinea/ui/icons/IcAlignJustify'
import {IcAlignLeft} from '@alinea/ui/icons/IcAlignLeft'
import IcAlignRight from '@alinea/ui/icons/IcAlignRight'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundDragHandle} from '@alinea/ui/icons/IcRoundDragHandle'
import {IcRoundFormatBold} from '@alinea/ui/icons/IcRoundFormatBold'
import {IcRoundFormatClear} from '@alinea/ui/icons/IcRoundFormatClear'
import {IcRoundFormatItalic} from '@alinea/ui/icons/IcRoundFormatItalic'
import {IcRoundFormatListBulleted} from '@alinea/ui/icons/IcRoundFormatListBulleted'
import {IcRoundFormatListNumbered} from '@alinea/ui/icons/IcRoundFormatListNumbered'
import IcRoundKeyboardArrowDown from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundNotes} from '@alinea/ui/icons/IcRoundNotes'
import {IcRoundRedo} from '@alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from '@alinea/ui/icons/IcRoundUndo'
import {mergeAttributes, Node} from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import FloatingMenuExtension from '@tiptap/extension-floating-menu'
import TextAlign from '@tiptap/extension-text-align'
import {
  Editor,
  EditorContent,
  FloatingMenu as TiptapFloatingMenu,
  NodeViewWrapper,
  ReactNodeViewRenderer
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {forwardRef, Ref, useCallback, useRef, useState} from 'react'
import {useEditor} from './hook/UseEditor'
import {RichTextField} from './RichTextField'
import css from './RichTextInput.module.scss'

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

enum Styles {
  paragraph = 'Normal text',
  h1 = 'Heading 1',
  h2 = 'Heading 2',
  h3 = 'Heading 3'
}

type ToolbarButtonsProps = {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
}

const ToolbarButtons = forwardRef(function ToolbarButtons(
  {editor, focusToggle}: ToolbarButtonsProps,
  ref: Ref<HTMLDivElement>
) {
  const selectedStyle = editor.isActive('heading', {level: 1})
    ? 'h1'
    : editor.isActive('heading', {level: 2})
    ? 'h2'
    : editor.isActive('heading', {level: 3})
    ? 'h3'
    : 'paragraph'

  return (
    <Toolbar.Slot>
      <div
        ref={ref}
        tabIndex={-1}
        className={styles.buttons()}
        onFocus={e => focusToggle(e.currentTarget)}
        onBlur={e => focusToggle(e.relatedTarget)}
      >
        <HStack center gap={10}>
          <IconButton
            icon={IcRoundUndo}
            size={18}
            title="Undo"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().undo().run()
            }}
            disabled={!editor.can().undo()}
          />
          <IconButton
            icon={IcRoundRedo}
            size={18}
            title="Redo"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().redo().run()
            }}
            disabled={!editor.can().redo()}
          />
          <div className={styles.buttons.separator()} />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              title="Heading/paragraph"
              className={styles.buttons.dropdown()}
            >
              {Styles[selectedStyle]}
              <Icon
                icon={IcRoundKeyboardArrowDown}
                size={20}
                className={styles.buttons.dropdown.icon('after')}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                onSelect={() => editor.chain().focus().clearNodes().run()}
              >
                <Typo.P>Normal text</Typo.P>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setHeading({level: 1}).run()
                }
              >
                <Typo.H1 flat>Heading 1</Typo.H1>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setHeading({level: 2}).run()
                }
              >
                <Typo.H2 flat>Heading 2</Typo.H2>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setHeading({level: 3}).run()
                }
              >
                <Typo.H3 flat>Heading 3</Typo.H3>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <div className={styles.buttons.separator()} />
          <IconButton
            icon={IcRoundFormatBold}
            size={18}
            title="Bold"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleBold().run()
            }}
            active={editor.isActive('bold')}
          />
          <IconButton
            icon={IcRoundFormatItalic}
            size={18}
            title="Italic"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleItalic().run()
            }}
            active={editor.isActive('italic')}
          />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              title="Alignment"
              className={styles.buttons.dropdown()}
            >
              <Icon
                icon={
                  editor.isActive({textAlign: 'center'})
                    ? IcAlignCenter
                    : editor.isActive({textAlign: 'right'})
                    ? IcAlignRight
                    : editor.isActive({textAlign: 'justify'})
                    ? IcAlignJustify
                    : IcAlignLeft
                }
                size={18}
                className={styles.buttons.dropdown.icon('before')}
              />
              <Icon
                icon={IcRoundKeyboardArrowDown}
                size={20}
                className={styles.buttons.dropdown.icon('after')}
                style={{marginLeft: 0}}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setTextAlign('left').run()
                }
              >
                <IconButton
                  icon={IcAlignLeft}
                  size={18}
                  title="Align left"
                  active={editor.isActive({textAlign: 'left'})}
                />
                Left
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setTextAlign('center').run()
                }
              >
                <IconButton
                  icon={IcAlignCenter}
                  size={18}
                  title="Align center"
                  active={editor.isActive({textAlign: 'center'})}
                />
                Center
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setTextAlign('right').run()
                }
              >
                <IconButton
                  icon={IcAlignRight}
                  size={18}
                  title="Align right"
                  active={editor.isActive({textAlign: 'right'})}
                />
                Right
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  editor.chain().focus().setTextAlign('justify').run()
                }
              >
                <IconButton
                  icon={IcAlignJustify}
                  size={18}
                  title="Align justify"
                  active={editor.isActive({textAlign: 'justify'})}
                />
                Justify
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <IconButton
            icon={IcRoundFormatClear}
            size={18}
            title="Clear format"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().unsetAllMarks().run()
              editor.chain().focus().unsetTextAlign().run()
            }}
          />
          <div className={styles.buttons.separator()} />
          <IconButton
            icon={IcRoundFormatListBulleted}
            size={18}
            title="Bullet list"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleBulletList().run()
            }}
            active={editor.isActive('bulletList')}
          />
          <IconButton
            icon={IcRoundFormatListNumbered}
            size={18}
            title="Ordered list"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleOrderedList().run()
            }}
            active={editor.isActive('orderedList')}
          />
        </HStack>
      </div>
    </Toolbar.Slot>
  )
})

export type RichTextInputProps<T> = {
  state: InputState<InputState.Text<T>>
  field: RichTextField<T>
}

export function RichTextInput<T>({state, field}: RichTextInputProps<T>) {
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
      extensions: [
        FloatingMenuExtension,
        Collaboration.configure({fragment}),
        StarterKit.configure(),
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        ...schemaToExtensions(state, blocks)
      ]
    },
    [fragment]
  )
  if (!editor) return null
  return (
    <>
      {focus && (
        <ToolbarButtons
          ref={toolbarRef}
          editor={editor}
          focusToggle={focusToggle}
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
