import {Button, Icon, Label} from '#/components.js'
import {RichTextField as CoreRichTextField} from '#/core/field/RichTextField.js'
import {createId} from '#/core/Id.js'
import {Schema} from '#/core/Schema.js'
import {BlockNode, Node, TextDoc} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries, values} from '#/core/util/Objects.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader,
  SurfaceRow
} from '#/dashboard/app/ui/Surface.js'
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
} from '#/dashboard/hooks.js'
import {RichTextOptions} from '#/field/richtext/RichTextField.js'
import styler from '@alinea/styler'
import {Node as TipTapNode} from '@tiptap/core'
import type {Editor as TipTapEditor} from '@tiptap/react'
import {
  EditorContent,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor
} from '@tiptap/react'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {extensions as baseExtensions} from './Extensions.js'
import {InsertMenu} from './InsertMenu.js'
import {PickTextLink, usePickTextLink} from './PickTextLink.js'
import {
  decodeRichTextBlock,
  encodeRichTextBlock,
  richTextBlockAttribute,
  richTextBlockAttributes
} from './RichTextBlockCodec.js'
import {cacheRichTextBlocks, fromContent, toContent} from './RichTextContent.js'
import css from './RichTextField.module.css'
import {RichTextToolbar} from './RichTextToolbar.js'

const styles = styler(css)

interface NodeViewProps {
  editor: TipTapEditor
  getPos: () => number | undefined
  node: {
    attrs: {[BlockNode.id]?: string}
    nodeSize: number
  }
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
    <SurfaceHeader className={styles.RichTextFieldBlock.header()}>
      <div
        className={styles.RichTextFieldBlock.title()}
        data-drag-handle
        role="button"
      >
        <Button
          appearance="plain"
          intent="secondary"
          size="icon-nav"
          className={styles.RichTextFieldBlock.fold()}
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
      <div className={styles.RichTextFieldBlock.actions()}>
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
  reactive: ReactiveNode<TextDoc>,
  name: string,
  type: Type,
  expandedByBlockId: Map<string, boolean>
) {
  const fieldKeys = entries(Type.initialValue(type)).map(([key]) => key)

  function View({editor, getPos, node, deleteNode}: NodeViewProps) {
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

    const rowNodeAtom = useMemo(() => {
      return atom(get => {
        const nodes = get(reactive.nodes) as Array<ReactiveNode> | undefined
        return nodes?.find(node => {
          const value = get(node.value) as Node | undefined
          return isEditableBlockValue(value, blockId, name, fieldKeys)
        })
      })
    }, [blockId])
    const rowNode = useAtomValue(rowNodeAtom) as
      | ReactiveNode<object>
      | undefined
    const rowValueAtom = useMemo(() => {
      return atom(get => {
        if (!rowNode) return
        return get(rowNode.value) as Node
      })
    }, [rowNode])
    const rowValue = useAtomValue(rowValueAtom)
    useEffect(() => {
      if (!isBlockNode(rowValue)) return
      cacheRichTextBlocks([rowValue])
      const pos = getPos()
      if (typeof pos !== 'number') return
      const editorNode = editor.view.state.doc.nodeAt(pos)
      if (!editorNode || editorNode.type.name !== name) return
      const currentBlock = editorNode.attrs[richTextBlockAttribute]
      if (encodeRichTextBlock(currentBlock) === encodeRichTextBlock(rowValue))
        return
      const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, {
        ...editorNode.attrs,
        ...richTextBlockAttributes(rowValue)
      })
      tr.setMeta('addToHistory', false)
      editor.view.dispatch(tr)
    }, [editor, getPos, rowValue])
    const copyBlockAtom = useMemo(() => {
      return atom(null, (get, set): BlockNode | undefined => {
        if (!rowNode) return
        const nodes = get(reactive.nodes) as
          | Array<ReactiveNode<object>>
          | undefined
        const index = nodes?.indexOf(rowNode)
        if (index === undefined || index < 0) return
        const value = get(rowNode.value) as Node
        if (!isBlockNode(value)) return
        const newId = createId()
        const block = {
          ...value,
          [BlockNode.id]: newId
        }
        set(reactive.insert, index + 1, block)
        return block
      })
    }, [rowNode])
    const copyBlock = useSetAtom(copyBlockAtom)

    function onCopy() {
      const pos = getPos()
      if (typeof pos !== 'number') return
      const block = copyBlock()
      if (!block) return
      editor
        .chain()
        .focus()
        .insertContentAt(pos + node.nodeSize, {
          type: name,
          attrs: richTextBlockAttributes(block)
        })
        .run()
    }

    if (!rowNode) return null
    return (
      <NodeViewWrapper>
        <Surface className={styles.RichTextFieldBlock()} tabIndex={0}>
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
            <SurfaceContent className={styles.RichTextFieldBlock.body()}>
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
        [BlockNode.id]: {default: null},
        [richTextBlockAttribute]: {
          default: null,
          parseHTML(element) {
            return decodeRichTextBlock(
              element.getAttribute(richTextBlockAttribute)
            )
          },
          renderHTML(attributes) {
            const encoded = encodeRichTextBlock(
              attributes[richTextBlockAttribute]
            )
            if (!encoded) return {}
            return {[richTextBlockAttribute]: encoded}
          }
        }
      }
    }
  })
}

function isEditableBlockValue(
  value: unknown,
  blockId: string,
  name: string,
  fieldKeys: Array<string>
): value is BlockNode {
  if (!isBlockNode(value)) return false
  if (String(value[BlockNode.id]) !== blockId) return false
  if (value[Node.type] !== name) return false
  for (const key of fieldKeys) {
    if (!(key in value)) return false
  }
  return true
}

function isBlockNode(value: unknown): value is BlockNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Node.isBlock(value)
  )
}

function schemaToExtensions(
  reactive: ReactiveNode<TextDoc>,
  schema: Schema | undefined,
  expandedByBlockId: Map<string, boolean>
) {
  if (!schema) return []
  return entries(schema).map(([name, type]) => {
    return typeExtension(reactive, name, type, expandedByBlockId)
  })
}

function RTView<Blocks extends Schema>({
  field
}: RichTextFieldViewProps<Blocks>) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const toolbar = document.getElementById('alinea-toolbar')
  const picker = usePickTextLink()
  const setValue = useFieldSetter(field)
  const node = useFieldNode<TextDoc>(field)
  const peekValue = useSetAtom(node.peek)
  const [focus, setFocus] = useState(false)
  const expandedByBlockId = useRef(new Map<string, boolean>())
  const containerRef = useRef<HTMLDivElement>(null)
  const content = useMemo(() => {
    const value = peekValue()
    return {
      type: 'doc',
      content: value?.map(toContent) ?? []
    }
  }, [peekValue])
  const base = useMemo(() => {
    return values(options.extensions ?? baseExtensions)
  }, [options.extensions])
  const extensions = useMemo(() => {
    const schemaExtensions = schemaToExtensions(
      node,
      options.schema,
      expandedByBlockId.current
    )
    return [...base, ...schemaExtensions]
  }, [base, node, options.schema])
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
      setValue(current => fromContent(editor.getJSON(), current))
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
        shared={options.shared}
      >
        {editor && !readOnly && (
          <InsertMenu
            editor={editor}
            schema={options.schema}
            onInsert={(id, typeName) => {
              const type = options.schema?.[typeName]
              const block = {
                [Node.type]: typeName,
                [BlockNode.id]: id,
                ...(type ? Type.initialValue(type) : {})
              } as BlockNode
              setValue(current => [...(current ?? []), block])
              return block
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

export interface RichTextFieldCompactViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
  value: TextDoc<Blocks>
}

export function RichTextFieldCompactView<Blocks extends Schema>({
  value
}: RichTextFieldCompactViewProps<Blocks>) {
  const text = richTextPreviewText(value)
  return (
    <span
      className={styles.RichTextFieldCompactView()}
      data-empty={text ? undefined : 'true'}
    >
      {text || '-'}
    </span>
  )
}

function richTextPreviewText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value))
    return value.map(richTextPreviewText).filter(Boolean).join(' ')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const text = record.text
  const content = record.content
  return [
    typeof text === 'string' ? text : '',
    Array.isArray(content) ? richTextPreviewText(content) : ''
  ]
    .filter(Boolean)
    .join(' ')
}
