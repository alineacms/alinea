import {Button, Icon, Label} from '#/components.js'
import {Field} from '#/core/Field.js'
import {RichTextField as CoreRichTextField} from '#/core/field/RichTextField.js'
import {getType} from '#/core/Internal.js'
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
import {
  EditorContent,
  JSONContent,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor
} from '@tiptap/react'
import {atom, useAtomValue, useStore} from 'jotai'
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {IcRoundClose, IcRoundDragHandle} from '../../../icons.js'
import {NodeEditor} from '../../Editor.js'
import {Surface, SurfaceContent, SurfaceHeader} from '../../ui/Surface.js'
import {extensions as baseExtensions} from './Extensions.js'
import {InsertMenu} from './InsertMenu.js'
import {PickTextLink, usePickTextLink} from './PickTextLink.js'
import css from './RichTextField.module.css'
import {RichTextToolbar} from './RichTextToolbar.js'

const styles = styler(css)

type NodeViewProps = {
  node: {attrs: {[BlockNode.id]?: string}}
  deleteNode: () => void
}

function typeExtension(field: Field, name: string, type: Type) {
  function RichTextFieldBlock({node, deleteNode}: NodeViewProps) {
    const reactive = useFieldNode(field)
    const options = useFieldOptions(field)
    const {[BlockNode.id]: id} = node.attrs
    const meta = getType(type)
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
    const rowNode = useAtomValue(rowNodeAtom) as
      | ReactiveNode<object>
      | undefined
    const rowValueAtom = useMemo(() => {
      return atom(get => (rowNode ? get(rowNode.value) : undefined))
    }, [rowNode])
    const rowValue = useAtomValue(rowValueAtom) as object | undefined
    const hydratedValue = useMemo(() => {
      return rowValue ? hydrateBlockValue(rowValue, type) : rowValue
    }, [rowValue, type])
    const store = useStore()
    useEffect(() => {
      if (!rowNode || !hydratedValue || hydratedValue === rowValue) return
      store.set(rowNode.value, hydratedValue)
    }, [hydratedValue, rowNode, rowValue, store])
    if (!rowNode) return null
    if (hydratedValue !== rowValue) return null
    return (
      <NodeViewWrapper>
        <Surface className={styles.RichTextFieldBlock()}>
          <SurfaceHeader className={styles.RichTextFieldBlock.header()}>
            <Button
              aria-label="Drag block"
              appearance="plain"
              className={styles.RichTextFieldBlock.drag()}
              data-drag-handle
              size="icon"
            >
              <Icon aria-hidden icon={meta.icon || IcRoundDragHandle} />
            </Button>
            <strong className={styles.RichTextFieldBlock.title()}>
              {Type.label(type)}
            </strong>
            {!options.readOnly && (
              <Button
                aria-label="Remove block"
                appearance="plain"
                intent="secondary"
                size="icon"
                onPress={deleteNode}
              >
                <Icon aria-hidden icon={IcRoundClose} />
              </Button>
            )}
          </SurfaceHeader>
          <SurfaceContent className={styles.RichTextFieldBlock.body()}>
            <NodeEditor type={type} node={rowNode} />
          </SurfaceContent>
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
      return ReactNodeViewRenderer(RichTextFieldBlock)
    },
    addAttributes() {
      return {
        [BlockNode.id]: {default: null}
      }
    }
  })
}

function hydrateBlockValue(value: object, type: Type): object {
  const initialValue = Type.initialValue(type)
  let changed = false
  const result = {...value} as Record<string, unknown>
  for (const [key, initial] of entries(initialValue)) {
    if (key in result) continue
    result[key] = initial
    changed = true
  }
  return changed ? result : value
}

function schemaToExtensions(field: Field, schema: Schema | undefined) {
  if (!schema) return []
  return entries(schema).map(([name, type]) => {
    return typeExtension(field, name, type)
  })
}

function RTView<Blocks extends Schema>({
  field
}: RichTextFieldViewProps<Blocks>) {
  const store = useStore()
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const toolbar = document.getElementById('alinea-toolbar')
  const setValue = useFieldSetter(field)
  const node = useFieldNode(field)
  const picker = usePickTextLink()
  const [focus, setFocus] = useState(false)
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
    const schemaExtensions = schemaToExtensions(field, options.schema)
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
      <PickTextLink picker={picker} />
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
