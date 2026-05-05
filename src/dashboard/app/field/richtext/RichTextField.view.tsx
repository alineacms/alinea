import {Button, Icon, Label} from '#/components.js'
import {Field} from '#/core/Field.js'
import {RichTextField as CoreRichTextField} from '#/core/field/RichTextField.js'
import {createId} from '#/core/Id.js'
import {Schema} from '#/core/Schema.js'
import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  TextDoc,
  TextNode
} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries, fromEntries, values} from '#/core/util/Objects.js'
import {
  IcBaselineContentCopy,
  IcRoundClose,
  IcRoundKeyboardArrowDown,
  IcRoundKeyboardArrowUp
} from '#/dashboard/icons.js'
import {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useFieldSetter
} from '#/dashboard/store/hooks.js'
import {RichTextOptions} from '#/field/richtext/RichTextField.js'
import styler from '@alinea/styler'
import {Node as TipTapNode} from '@tiptap/core'
import type {Editor as TipTapEditor} from '@tiptap/react'
import {
  EditorContent,
  JSONContent,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor
} from '@tiptap/react'
import {atom, useAtomValue, useStore} from 'jotai'
import {memo, useCallback, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {NodeEditor} from '../../Editor.js'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader,
  SurfaceRow
} from '../../ui/Surface.js'
import {extensions as baseExtensions} from './Extensions.js'
import {InsertMenu} from './InsertMenu.js'
import {PickTextLink, usePickTextLink} from './PickTextLink.js'
import css from './RichTextField.module.css'
import {RichTextToolbar} from './RichTextToolbar.js'

const styles = styler(css)

type NodeViewProps = {
  editor: TipTapEditor
  getPos: () => number | undefined
  node: {attrs: {[BlockNode.id]?: string}; nodeSize: number}
  deleteNode: () => void
}

interface TypeExtensionHeaderProps {
  type: Type
  exp: boolean
  onDelete: () => void
  onToggle: () => void
  onCopy: () => void
}

function TypeExtensionHeader({
  type,
  onDelete,
  onToggle,
  exp,
  onCopy
}: TypeExtensionHeaderProps) {
  const label = Type.label(type)
  return (
    <SurfaceHeader className={styles.RichTextFieldView.Surface.Header()}>
      <div
        className={styles.RichTextFieldView.Surface.Header.Label()}
        data-drag-handle
        role="button"
      >
        <Button
          appearance="plain"
          intent="secondary"
          size="square-petite"
          className={styles.ListFieldRow.fold()}
          onPress={onToggle}
        >
          <Icon
            aria-hidden
            icon={
              exp === true ? IcRoundKeyboardArrowDown : IcRoundKeyboardArrowUp
            }
          />
        </Button>
        {label}
      </div>
      <div className={styles.RichTextFieldView.Surface.Header.actions()}>
        <Button
          aria-label={`Duplicate ${label}`}
          appearance="outline"
          intent="secondary"
          onPress={onCopy}
          size="icon"
        >
          <Icon aria-hidden icon={IcBaselineContentCopy} />
        </Button>
        <Button
          aria-label={`Remove ${label}`}
          appearance="outline"
          intent="danger"
          onPress={onDelete}
          size="icon"
        >
          <Icon aria-hidden icon={IcRoundClose} />
        </Button>
      </div>
    </SurfaceHeader>
  )
}

function typeExtension(
  field: Field,
  name: string,
  type: Type,
  expandedByBlockId: Map<string, boolean>
) {
  function View({editor, getPos, node, deleteNode}: NodeViewProps) {
    const store = useStore()
    const setValue = useFieldSetter(field)
    const reactive = useFieldNode(field)
    const {[BlockNode.id]: id} = node.attrs
    const blockId = String(id ?? '')

    const [exp, setExp] = useState(() => {
      return expandedByBlockId.get(blockId) ?? true
    })

    function onToggle() {
      setExp(exp => {
        const next = !exp
        expandedByBlockId.set(blockId, next)
        return next
      })
    }

    function onCopy() {
      const value = (store.get(reactive.value) as TextDoc | undefined) ?? []
      const index = value.findIndex(node => {
        return Node.isBlock(node) && node[BlockNode.id] === id
      })
      const pos = getPos()
      if (index === -1 || typeof pos !== 'number') return

      const newId = createId()
      const clone = {...value[index], [BlockNode.id]: newId} as Node
      setValue([...value.slice(0, index + 1), clone, ...value.slice(index + 1)])
      editor
        .chain()
        .focus()
        .insertContentAt(pos + node.nodeSize, {
          type: name,
          attrs: {[BlockNode.id]: newId}
        })
        .run()
    }

    // Find the corresponding reactive node for this block
    const rowNodeAtom = useMemo(() => {
      return atom(get => {
        const nodes = get(reactive.nodes) as Array<ReactiveNode> | undefined
        return nodes?.find(node => {
          const value = get(node.value) as Node
          return Node.isBlock(value) && value[BlockNode.id] === id
        })
      })
    }, [reactive, id])
    const rowNode = useAtomValue(rowNodeAtom) as ReactiveNode<object>
    if (!rowNode) return null
    return (
      <NodeViewWrapper>
        <Surface className={styles.RichTextFieldView.Surface()} tabIndex={0}>
          <SurfaceRow>
            <TypeExtensionHeader
              type={type}
              onDelete={deleteNode}
              onToggle={onToggle}
              onCopy={onCopy}
              exp={exp}
            />
          </SurfaceRow>
          {exp && (
            <SurfaceContent>
              <NodeEditor type={type} node={rowNode} />
            </SurfaceContent>
          )}
        </Surface>
      </NodeViewWrapper>
    )
  }
  return TipTapNode.create({
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
        [BlockNode.id]: {default: null}
      }
    }
  })
}

function schemaToExtensions(
  field: Field,
  schema: Schema | undefined,
  expandedByBlockId: Map<string, boolean>
) {
  if (!schema) return []
  return entries(schema).map(([name, type]) => {
    return typeExtension(field, name, type, expandedByBlockId)
  })
}

function RTView<Blocks extends Schema>({
  field
}: RichTextFieldViewProps<Blocks>) {
  const store = useStore()
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const toolbar = document.getElementById('alinea-toolbar')
  const picker = usePickTextLink()
  const setValue = useFieldSetter(field)
  const node = useFieldNode(field)
  const [focus, setFocus] = useState(false)
  const expandedByBlockId = useRef(new Map<string, boolean>())
  const containerRef = useRef<HTMLDivElement>(null)
  const content = useMemo(() => {
    // Get the value once, but don't subscribe to updates
    const value = store.get(node.value) as TextDoc | undefined
    return {
      type: 'doc',
      content: value?.map(toContent) ?? []
    }
  }, [node, store])
  const extensions = useMemo(() => {
    const schemaExtensions = schemaToExtensions(
      field,
      options.schema,
      expandedByBlockId.current
    )
    return [...values(baseExtensions), ...schemaExtensions]
  }, [field, options.schema])
  const readOnly = options.readOnly || node.readOnly
  const editable = !readOnly
  const focusToggle = useCallback(function focusToggle(
    target: EventTarget | null
  ) {
    const element =
      (target as HTMLElement | null) ||
      (document.activeElement as HTMLElement | null)
    const editorElement = containerRef.current?.querySelector('.ProseMirror')
    setFocus(
      !!element &&
        (element.closest('[data-richtext-toolbar="true"]') !== null ||
          (editorElement instanceof HTMLElement &&
            (editorElement === element || editorElement.contains(element))))
    )
  }, [])
  const editor = useEditor({
    content,
    extensions,
    editable,
    onFocus({event}) {
      focusToggle(event.currentTarget)
    },
    onBlur({event}) {
      focusToggle(event.relatedTarget)
    },
    onUpdate({editor}) {
      const current = store.get(node.value) as TextDoc | undefined
      setValue(fromContent(editor.getJSON(), current))
    }
  })
  return (
    <>
      <PickTextLink picker={picker} />
      <Label
        description={options.help}
        errorMessage={error}
        isRequired={options.required}
        label={options.label}
      >
        {editor && !readOnly && (
          <InsertMenu
            editor={editor}
            schema={options.schema}
            onInsert={(id, typeName) => {
              const type = options.schema?.[typeName]
              setValue(current => [
                ...(current ?? []),
                {
                  [Node.type]: typeName,
                  [BlockNode.id]: id,
                  ...(type ? Type.initialValue(type) : {})
                } as Node
              ])
            }}
          />
        )}
        <EditorContent
          ref={containerRef}
          editor={editor}
          className={styles.RichTextFieldView()}
          data-invalid={Boolean(error) || undefined}
          data-read-only={readOnly || undefined}
        />
      </Label>
      {toolbar &&
        editor &&
        focus &&
        createPortal(
          <RichTextToolbar
            editor={editor}
            enableTables={options.enableTables}
            focusToggle={focusToggle}
            pickLink={picker.pickLink}
            toolbar={options.toolbar}
          />,
          toolbar
        )}
    </>
  )
}

export interface RichTextFieldViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
}

export const RichTextFieldView = memo(function RichTextFieldView<
  Blocks extends Schema
>({field}: RichTextFieldViewProps<Blocks>) {
  const node = useFieldNode(field)
  const isDirty = useAtomValue(node.isDirty)
  const prevIsDirty = useRef(isDirty)
  const wasReset = !isDirty && prevIsDirty.current
  prevIsDirty.current = isDirty
  // Tiptap really does not want you to control its state
  return <RTView field={field} key={`${node.value}:${wasReset}`} />
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

function fromContent(
  content: JSONContent,
  currentValue: Array<Node> = []
): Array<Node> {
  const blocksById = new Map(
    currentValue
      .filter(Node.isBlock)
      .map(node => [String(node[BlockNode.id]), node] as const)
  )
  const nodes =
    content.content?.flatMap(node => fromNode(node, blocksById)) ?? []
  const [first] = nodes
  const isEmptyParagraph =
    nodes.length === 1 &&
    Node.isElement(first) &&
    first[Node.type] === 'paragraph' &&
    first[ElementNode.content]?.length === 0
  return isEmptyParagraph ? [] : nodes
}

function fromNode(
  content: JSONContent,
  blocksById: Map<string, Node>
): Array<Node> {
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
    const id = String(attrs?.[BlockNode.id] ?? '')
    return [
      blocksById.get(id) ?? {
        [Node.type]: type,
        [BlockNode.id]: id
      }
    ]
  }
  const normalizedAttrs = normalizeNodeAttrs(attrs)
  return [
    {
      [Node.type]: type,
      ...normalizedAttrs,
      [ElementNode.content]: content.content?.flatMap(node =>
        fromNode(node, blocksById)
      )
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
