import {Elevation, Label} from '@alinea/components'
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
import {Field} from 'alinea/core/Field'
import {RichTextField as CoreRichTextField} from 'alinea/core/field/RichTextField'
import {createId} from 'alinea/core/Id'
import {Schema} from 'alinea/core/Schema'
import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  TextDoc,
  TextNode
} from 'alinea/core/TextDoc'
import {Type} from 'alinea/core/Type'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {RichTextOptions} from 'alinea/field/richtext/RichTextField'
import {
  ReactiveNode,
  useFieldNode,
  useFieldOptions,
  useFieldSetter
} from 'alinea/v2/store'
import {atom, useAtomValue, useStore} from 'jotai'
import {memo, useMemo} from 'react'
import {createPortal} from 'react-dom'
import {NodeEditor} from '../../Editor'
import {extensions as baseExtensions} from './Extensions.js'
import {InsertMenu} from './InsertMenu.js'
import css from './RichTextField.module.css'
import {RichTextToolbar} from './RichTextToolbar.js'

const styles = styler(css)

type NodeViewProps = {
  node: {attrs: {[BlockNode.id]?: string}}
  deleteNode: () => void
}

function typeExtension(field: Field, name: string, type: Type) {
  function View({node, deleteNode}: NodeViewProps) {
    const reactive = useFieldNode(field)
    const {[BlockNode.id]: id} = node.attrs
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
        <Elevation>
          <div>
            <button data-drag-handle style={{cursor: 'grab'}}>
              drag handle
            </button>
            Block, type: {Type.label(type)}
          </div>
          <NodeEditor type={type} node={rowNode} />
        </Elevation>
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
  const toolbar = document.getElementById('alinea-toolbar')
  const setValue = useFieldSetter(field)
  const node = useFieldNode(field)
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
  const editor = useEditor({
    content,
    extensions,
    onUpdate({editor}) {
      const current = store.get(node.value) as TextDoc | undefined
      setValue(fromContent(editor.getJSON(), current))
    }
  })
  return (
    <>
      <Label
        description={options.help}
        isRequired={options.required}
        label={options.label}
      >
        {editor && !options.readOnly && (
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
        <EditorContent editor={editor} className={styles.root()} />
      </Label>
      {toolbar &&
        editor &&
        createPortal(
          <RichTextToolbar
            editor={editor}
            enableTables={options.enableTables}
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
  const id = useMemo(createId, [node])
  // Tiptap really does not want you to control its state
  return <RTView field={field} key={id} />
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
