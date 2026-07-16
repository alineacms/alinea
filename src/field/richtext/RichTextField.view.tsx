import {Label} from '#/components.js'
import {RichTextField as CoreRichTextField} from '#/core/field/RichTextField.js'
import {createId} from '#/core/Id.js'
import type {Schema} from '#/core/Schema.js'
import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  useFieldError,
  useEntryAnchors,
  useFieldNode,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {
  configureRichTextExtensions,
  type RichTextOptions
} from './RichTextField.js'
import {PickTextLink, usePickTextLink} from './PickTextLink.js'
import styler from '@alinea/styler'
import type {AnyExtension, Editor} from '@tiptap/core'
import {EditorContent, useEditor} from '@tiptap/react'
import {useAtomValue, useSetAtom, useStore} from 'jotai'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import {createPortal} from 'react-dom'
import {RichTextBlock} from './RichTextBlock.js'
import {
  type ReactiveRichTextBlock,
  richTextStructureAtom
} from './RichTextBlocks.js'
import {
  type RichTextBlockHost,
  RichTextBlockHosts
} from './RichTextBlockHost.js'
import {editorContent, editorNodes} from './RichTextDocument.js'
import {
  defaultExtensionConfig,
  richTextBlockClipboard,
  richTextBlockExtensions,
  richTextDocumentExtension
} from './RichTextExtensions.js'
import {
  blockAttributes,
  decodeBlockValue,
  encodeBlockValue,
  richTextBlockValueAttribute
} from './RichTextBlockValue.js'
import css from './RichTextField.module.css'
import {RichTextInsertMenu} from './RichTextInsertMenu.js'
import {documentUpdateAtom} from './RichTextState.js'
import {RichTextToolbar} from './RichTextToolbar.js'
import {PickTextAnchor, usePickTextAnchor} from './PickTextAnchor.js'

const styles = styler(css)

export interface RichTextFieldViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
}

export function RichTextFieldView<Blocks extends Schema>({
  field
}: RichTextFieldViewProps<Blocks>) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const fieldNode = useFieldNode<TextDoc>(field)
  const store = useStore()
  const {blocks, structure} = useAtomValue(
    useMemo(() => richTextStructureAtom(fieldNode), [fieldNode])
  )
  const blocksById = useMemo(
    () => new Map(blocks.map(block => [block.id, block])),
    [blocks]
  )
  const blocksByIdRef = useRef(blocksById)
  blocksByIdRef.current = blocksById
  const lastEditorDocument = useRef<string>()
  const pendingExternalDocument = useRef<string>()
  const documentKey = documentStructureKey(structure)
  if (lastEditorDocument.current && lastEditorDocument.current !== documentKey)
    pendingExternalDocument.current = documentKey
  const updateDocument = useSetAtom(
    useMemo(() => documentUpdateAtom(fieldNode), [fieldNode])
  )
  const hosts = useMemo(() => new RichTextBlockHosts(), [])
  const pendingBlocks = useRef(new Map<string, BlockNode>())
  const [activeEditor, setActiveEditor] = useState<Editor>()
  const [focused, setFocused] = useState(false)
  const [innerBlockFocused, setInnerBlockFocused] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const ownerId = useId()
  const picker = usePickTextLink()
  const anchorPicker = usePickTextAnchor()
  const entryAnchors = useEntryAnchors()
  const entryAnchorIds = useMemo(
    () => entryAnchors.map(anchor => anchor.id),
    [entryAnchors]
  )
  const entryAnchorIdsRef = useRef(entryAnchorIds)
  entryAnchorIdsRef.current = entryAnchorIds
  const getEntryAnchors = useCallback(() => entryAnchorIdsRef.current, [])
  const readOnly = Boolean(options.readOnly || fieldNode.readOnly)
  const extensions = useMemo<Array<AnyExtension>>(() => {
    const configured = Object.values(
      configureRichTextExtensions(
        options.extensions,
        defaultExtensionConfig(getEntryAnchors)
      )
    )
    const blocks = richTextBlockExtensions(options.schema, hosts)
    return [
      richTextDocumentExtension(blocks.length > 0),
      richTextBlockClipboard,
      ...configured.filter(extension => extension.name !== 'doc'),
      ...blocks
    ]
  }, [getEntryAnchors, hosts, options.extensions, options.schema])
  const content = useMemo(
    () => editorContent(store.get(fieldNode.value)),
    [fieldNode, store]
  )

  const resolveBlock = useCallback(
    function resolveBlock(
      id: string,
      typeName: string,
      snapshot: BlockNode | undefined
    ): BlockNode | undefined {
      const pending = pendingBlocks.current.get(id)
      if (pending) return pending
      const part = blocksByIdRef.current.get(id)
      if (part) {
        const value = store.get(part.node.value)
        if (Node.isBlock(value)) return value
      }
      if (snapshot?.[Node.type] === typeName) return snapshot
      const type = options.schema?.[typeName]
      if (!type) return
      return {
        [Node.type]: typeName,
        [BlockNode.id]: id,
        ...Type.initialValue(type)
      } as BlockNode
    },
    [options.schema, store]
  )

  const editor = useEditor({
    content,
    extensions,
    editable: !readOnly,
    onCreate({editor}) {
      // ProseMirror owns selection restoration. React's contenteditable
      // traversal cannot safely inspect nested ProseMirror-owned DOM.
      setEditorReadOnly(editor, readOnly)
      lastEditorDocument.current = documentStructureKey(
        editorNodes(editor.getJSON(), resolveBlock)
      )
    },
    onFocus({editor}) {
      setActiveEditor(editor)
      setFocused(true)
    },
    onUpdate({editor, transaction}) {
      if (!transaction.docChanged) return
      const next = editorNodes(editor.getJSON(), resolveBlock)
      const nextKey = documentStructureKey(next)
      if (
        pendingExternalDocument.current &&
        nextKey === lastEditorDocument.current
      )
        return
      lastEditorDocument.current = nextKey
      if (nextKey === pendingExternalDocument.current)
        pendingExternalDocument.current = undefined
      updateDocument(next)
      for (const node of next)
        if (Node.isBlock(node))
          pendingBlocks.current.delete(String(node[BlockNode.id]))
    }
  })

  useEffect(() => {
    if (editor) setEditorReadOnly(editor, readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor) return
    const current = editorNodes(editor.getJSON(), resolveBlock)
    if (documentKey === documentStructureKey(current)) return
    const documentValue = store.get(fieldNode.value)
    editor.commands.setContent(editorContent(documentValue), {
      emitUpdate: false
    })
    lastEditorDocument.current = documentKey
    pendingExternalDocument.current = undefined
  }, [documentKey, editor, fieldNode, resolveBlock, store])

  const toolbarTarget =
    typeof document === 'undefined'
      ? null
      : document.getElementById('alinea-toolbar')

  function insertBlock(block: BlockNode) {
    if (!editor || editor.state.selection.$from.depth !== 1) return
    const id = String(block[BlockNode.id])
    pendingBlocks.current.set(id, block)
    // The menu preserves the editor selection. Refocusing here makes React
    // inspect ProseMirror-owned DOM while the new block portal is mounting.
    const inserted = editor
      .chain()
      .insertContent({type: block[Node.type], attrs: {[BlockNode.id]: id}})
      .run()
    if (!inserted) pendingBlocks.current.delete(id)
  }

  function checkFocus() {
    requestAnimationFrame(() => {
      const target = document.activeElement
      setFocused(ownsFocus(target))
      setInnerBlockFocused(isInnerBlockField(target))
    })
  }

  function handleBlur(nextTarget: EventTarget | null) {
    if (nextTarget instanceof HTMLElement) {
      setFocused(ownsFocus(nextTarget))
      setInnerBlockFocused(isInnerBlockField(nextTarget))
    } else checkFocus()
  }

  function ownsFocus(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const richText = target.closest<HTMLElement>('[data-richtext-field]')
    if (richText && richText !== root.current) return false
    if (root.current?.contains(target)) return true
    const toolbar = target.closest<HTMLElement>('[data-richtext-toolbar-owner]')
    return toolbar?.dataset.richtextToolbarOwner === ownerId
  }

  function isInnerBlockField(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      root.current?.contains(target) === true &&
      target.closest('[data-richtext-block-editor]') !== null
    )
  }

  return (
    <>
      <PickTextLink picker={picker} />
      <PickTextAnchor picker={anchorPicker} />
      <Label
        description={options.help}
        errorMessage={error}
        isRequired={options.required}
        label={options.label}
        shared={options.shared}
      >
        <div
          ref={root}
          className={styles.RichTextFieldView()}
          data-richtext-field={ownerId}
          data-inline={options.inline || undefined}
          data-invalid={Boolean(error) || undefined}
          data-focused={
            focused && !innerBlockFocused && !readOnly ? 'true' : undefined
          }
          data-read-only={readOnly || undefined}
          onFocusCapture={event => {
            setFocused(ownsFocus(event.target))
            setInnerBlockFocused(isInnerBlockField(event.target))
          }}
          onBlurCapture={event => handleBlur(event.relatedTarget)}
        >
          {editor && !readOnly && options.schema && (
            <RichTextInsertMenu
              editor={editor}
              schema={options.schema}
              onInsert={insertBlock}
            />
          )}
          <EditorContent editor={editor} />
          {editor && (
            <RichTextBlockPortals
              blocksById={blocksById}
              editor={editor}
              hosts={hosts}
              pendingBlocks={pendingBlocks.current}
              readOnly={readOnly}
              schema={options.schema}
              store={store}
            />
          )}
        </div>
      </Label>
      {toolbarTarget &&
      editor &&
      activeEditor === editor &&
      focused &&
      !readOnly
        ? createPortal(
            <RichTextToolbar
              editor={editor}
              enableTables={options.enableTables}
              ownerId={ownerId}
              pickLink={picker.pickLink}
              pickAnchor={anchorPicker.pickAnchor}
              entryAnchors={entryAnchorIds}
              toolbar={options.toolbar}
              onFocusChange={(next, nextTarget) => {
                if (next) setFocused(true)
                else handleBlur(nextTarget ?? null)
              }}
            />,
            toolbarTarget
          )
        : null}
    </>
  )
}

function setEditorReadOnly(editor: Editor, readOnly: boolean) {
  editor.setEditable(!readOnly, false)
  editor.view.dom.contentEditable = readOnly ? 'false' : 'plaintext-only'
}

interface RichTextBlockPortalsProps {
  blocksById: ReadonlyMap<string, ReactiveRichTextBlock>
  editor: Editor
  hosts: RichTextBlockHosts
  pendingBlocks: Map<string, BlockNode>
  readOnly: boolean
  schema?: Schema
  store: ReturnType<typeof useStore>
}

function RichTextBlockPortals({
  blocksById,
  editor,
  hosts,
  pendingBlocks,
  readOnly,
  schema,
  store
}: RichTextBlockPortalsProps) {
  const mounted = useSyncExternalStore(
    hosts.subscribe,
    hosts.snapshot,
    hosts.snapshot
  )

  function remove(host: RichTextBlockHost) {
    const position = host.getPos()
    if (typeof position !== 'number') return
    editor.commands.deleteRange({from: position, to: position + 1})
  }

  function duplicate(host: RichTextBlockHost, part: ReactiveRichTextBlock) {
    const position = host.getPos()
    if (typeof position !== 'number') return
    const value = store.get(part.node.value)
    if (!Node.isBlock(value)) return
    const id = createId()
    const block = {...value, [BlockNode.id]: id}
    pendingBlocks.set(id, block)
    const inserted = editor
      .chain()
      .insertContentAt(position + 1, {
        type: host.typeName,
        attrs: {[BlockNode.id]: id}
      })
      .run()
    if (!inserted) pendingBlocks.delete(id)
  }

  return mounted.map(host => {
    const part = blocksById.get(host.id)
    const type = schema?.[host.typeName]
    if (!part || !type) return null
    return createPortal(
      <>
        <RichTextBlockSnapshot editor={editor} host={host} node={part.node} />
        <RichTextBlock
          id={part.id}
          node={part.node}
          type={type}
          readOnly={readOnly}
          onDelete={() => remove(host)}
          onDuplicate={() => duplicate(host, part)}
        />
      </>,
      host.dom,
      host.id
    )
  })
}

interface RichTextBlockSnapshotProps {
  editor: Editor
  host: RichTextBlockHost
  node: ReactiveRichTextBlock['node']
}

function RichTextBlockSnapshot({
  editor,
  host,
  node
}: RichTextBlockSnapshotProps) {
  const value = useAtomValue(node.value)

  useEffect(() => {
    if (!Node.isBlock(value)) return
    const position = host.getPos()
    if (typeof position !== 'number') return
    const editorNode = editor.state.doc.nodeAt(position)
    if (!editorNode || editorNode.type.name !== host.typeName) return
    const current = decodeBlockValue(
      editorNode.attrs[richTextBlockValueAttribute]
    )
    if (encodeBlockValue(current) === encodeBlockValue(value)) return
    const transaction = editor.state.tr.setNodeMarkup(
      position,
      undefined,
      blockAttributes(value)
    )
    transaction.setMeta('addToHistory', false)
    editor.view.dispatch(transaction)
  }, [editor, host, value])

  return null
}

function documentStructureKey(value: TextDoc): string {
  return stableStringify(
    value.map(node =>
      Node.isBlock(node)
        ? {[Node.type]: node[Node.type], [BlockNode.id]: node[BlockNode.id]}
        : node
    )
  )
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? String(value)
}

export interface RichTextFieldCompactViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
  value: TextDoc<Blocks>
}

export function RichTextFieldCompactView<Blocks extends Schema>({
  value
}: RichTextFieldCompactViewProps<Blocks>) {
  const text = previewText(value)
  return (
    <span
      className={styles.RichTextFieldCompactView()}
      data-empty={text ? undefined : 'true'}
    >
      {text || '-'}
    </span>
  )
}

function previewText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value))
    return value.map(previewText).filter(Boolean).join(' ')
  if (!isRecord(value)) return ''
  return [previewText(value.text), previewText(value.content)]
    .filter(Boolean)
    .join(' ')
}
