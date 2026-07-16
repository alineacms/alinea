import type {Schema} from '#/core/Schema.js'
import {createId} from '#/core/Id.js'
import {BlockNode} from '#/core/TextDoc.js'
import {entries} from '#/core/util/Objects.js'
import styler from '@alinea/styler'
import {
  Extension,
  mergeAttributes,
  Node as TipTapNode,
  type AnyExtension
} from '@tiptap/core'
import {Fragment, type Node as ProseMirrorNode, Slice} from '@tiptap/pm/model'
import {dropPoint} from '@tiptap/pm/transform'
import type {EditorView} from '@tiptap/pm/view'
import {Plugin} from '@tiptap/pm/state'
import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import FloatingMenu from '@tiptap/extension-floating-menu'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
import Highlight from '@tiptap/extension-highlight'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Italic from '@tiptap/extension-italic'
import {BulletList, ListItem, OrderedList} from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import {Table, TableCell, TableHeader, TableRow} from '@tiptap/extension-table'
import Text from '@tiptap/extension-text'
import TextAlign from '@tiptap/extension-text-align'
import {Dropcursor, Gapcursor, UndoRedo} from '@tiptap/extensions'
import type {RichTextBlockHosts} from './RichTextBlockHost.js'
import {
  decodeBlockValue,
  encodeBlockValue,
  richTextBlockValueAttribute
} from './RichTextBlockValue.js'
import {Link} from './extensions/Link.js'
import Small from './extensions/Small.js'
import Anchor from './extensions/Anchor.js'
import css from './RichTextExtensions.module.css'
import {createUniqueAnchor} from 'alinea/core/util/Anchors'
import {slugify} from 'alinea/core/util/Slugs'

const styles = styler(css)

const HeadingWithClasses = Heading.extend({
  addAttributes() {
    return {...(this.parent?.() ?? {}), _anchor: {default: null}}
  },
  renderHTML({node, HTMLAttributes}) {
    const level = this.options.levels.includes(node.attrs.level)
      ? node.attrs.level
      : this.options.levels[0]
    return [
      `h${level}`,
      mergeAttributes(HTMLAttributes, {
        class: styles.RichTextExtensions.heading(`level${level}`)
      }),
      0
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(_transaction, oldState, newState) {
          const tr = newState.tr
          let modified = false
          const anchors = new Set<string>()
          const previousHeadings: Array<ProseMirrorNode> = []
          oldState.doc.descendants(node => {
            if (node.type.name === 'heading') previousHeadings.push(node)
          })
          const headings: Array<{
            node: ProseMirrorNode
            pos: number
            custom: boolean
          }> = []
          let headingIndex = 0
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return
            const previous = previousHeadings[headingIndex++]
            const custom = isCustomHeadingAnchor(node, previous)
            headings.push({node, pos, custom})
            if (custom && typeof node.attrs._anchor === 'string')
              anchors.add(node.attrs._anchor)
          })
          for (const {node, pos, custom} of headings) {
            const slug = custom
              ? node.attrs._anchor
              : (createUniqueAnchor(slugify(node.textContent), anchors) ?? null)
            if (!custom && typeof slug === 'string') anchors.add(slug)
            if (node.attrs._anchor === slug) continue
            tr.setNodeMarkup(pos, undefined, {...node.attrs, _anchor: slug})
            node.descendants((child, childPos) => {
              if (!child.isText || !child.text) return true
              const from = pos + childPos + 1
              const to = from + child.text.length
              if (slug)
                tr.addMark(
                  from,
                  to,
                  newState.schema.marks.anchor.create({id: slug})
                )
              return false
            })
            modified = true
          }
          return modified ? tr : null
        }
      })
    ]
  }
})

function isCustomHeadingAnchor(
  heading: ProseMirrorNode,
  previous: ProseMirrorNode | undefined
): boolean {
  const anchor = heading.attrs._anchor
  const generated = slugify(heading.textContent)
  if (!previous) return anchor != null && anchor !== generated
  const previousAnchor = previous.attrs._anchor
  if (heading.textContent === previous.textContent && anchor !== previousAnchor)
    return anchor !== generated
  return (
    previousAnchor != null && previousAnchor !== slugify(previous.textContent)
  )
}

export function richTextDocumentExtension(hasEmbeddedBlocks: boolean) {
  return Document.extend({
    content: hasEmbeddedBlocks ? '(block | richTextBlock)+' : 'block+'
  })
}

export const richTextBlockClipboard = Extension.create({
  name: 'richTextBlockClipboard',
  addProseMirrorPlugins() {
    let draggedBlockId: string | undefined
    return [
      new Plugin({
        filterTransaction(transaction) {
          return (
            !transaction.docChanged || !hasNestedRichTextBlock(transaction.doc)
          )
        },
        props: {
          handleDOMEvents: {
            dragstart(_view, event) {
              const target = event.target
              draggedBlockId =
                target instanceof Element
                  ? target.closest<HTMLElement>('[data-richtext-block-host]')
                      ?.dataset.richtextBlockId
                  : undefined
              return false
            },
            dragend() {
              draggedBlockId = undefined
              return false
            }
          },
          transformPasted(slice) {
            return renewPastedBlockIds(slice)
          },
          handleDrop(view, event, slice, moved) {
            const handled = moveDroppedBlock(
              view,
              event,
              slice,
              moved,
              draggedBlockId
            )
            draggedBlockId = undefined
            return handled
          }
        }
      })
    ]
  }
})

export const extensions = createExtensions()

export function defaultExtensionConfig() {
  return createExtensions()
}

export function defaultExtensions(): Array<AnyExtension> {
  return Object.values(defaultExtensionConfig())
}

export function richTextBlockExtensions(
  schema: Schema | undefined,
  hosts: RichTextBlockHosts
): Array<AnyExtension> {
  if (!schema) return []
  return entries(schema).map(([name]) =>
    TipTapNode.create({
      name,
      group: 'richTextBlock',
      atom: true,
      draggable: true,
      selectable: true,
      addAttributes() {
        return {
          [BlockNode.id]: {default: null},
          [richTextBlockValueAttribute]: {
            default: null,
            parseHTML(element) {
              return decodeBlockValue(
                element.getAttribute(richTextBlockValueAttribute)
              )
            },
            renderHTML(attributes) {
              const encoded = encodeBlockValue(
                attributes[richTextBlockValueAttribute]
              )
              return encoded ? {[richTextBlockValueAttribute]: encoded} : {}
            }
          }
        }
      },
      parseHTML() {
        return [{tag: `[data-richtext-block-type="${name}"]`}]
      },
      renderHTML({HTMLAttributes}) {
        return [
          'div',
          mergeAttributes(HTMLAttributes, {
            'data-richtext-block-type': name
          })
        ]
      },
      addNodeView() {
        return hosts.nodeView(name)
      }
    })
  )
}

function createExtensions() {
  return {
    Document,
    Text,
    Paragraph: Paragraph.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.paragraph()}
    }),
    Anchor: Anchor.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.anchor()}
    }),
    Small: Small.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.small()}
    }),
    Bold: Bold.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.bold()}
    }),
    Italic: Italic.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.italic()}
    }),
    Strike: Strike.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.strike()}
    }),
    HorizontalRule: HorizontalRule.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.rule()}
    }),
    BulletList: BulletList.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.bulletList()}
    }),
    OrderedList: OrderedList.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.orderedList()}
    }),
    ListItem: ListItem.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.listItem()}
    }),
    Blockquote: Blockquote.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.blockquote()}
    }),
    HardBreak,
    Heading: HeadingWithClasses,
    TextAlign: TextAlign.configure({types: ['heading', 'paragraph']}),
    Dropcursor,
    Gapcursor,
    Link: Link.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.link()}
    }),
    FloatingMenu,
    SuperScript: Superscript.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.superscript()}
    }),
    SubScript: Subscript.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.subscript()}
    }),
    Table: Table.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.table()}
    }),
    TableCell: TableCell.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.tableCell()}
    }),
    TableHeader: TableHeader.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.tableHeader()}
    }),
    TableRow,
    Highlight: Highlight.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.highlight()}
    }),
    UndoRedo
  }
}

function moveDroppedBlock(
  view: EditorView,
  event: DragEvent,
  slice: Slice,
  moved: boolean,
  draggedBlockId?: string
): boolean {
  if (!moved) return false
  const dragged =
    slice.content.childCount === 1 ? slice.content.firstChild : undefined
  if (!dragged || !isRichTextBlockNode(dragged)) return false
  const sourceId =
    draggedBlockId ||
    event.dataTransfer?.getData('application/x-alinea-richtext-block') ||
    String(dragged.attrs[BlockNode.id])

  const coordinates = view.posAtCoords({
    left: event.clientX,
    top: event.clientY
  })
  if (!coordinates) return false

  const drop = dropPoint(view.state.doc, coordinates.pos, slice)
  if (drop == null) return false
  const resolvedDrop = view.state.doc.resolve(drop)
  if (resolvedDrop.depth !== 0) return false

  let sourcePosition: number | undefined
  let sourceNode: ProseMirrorNode | undefined
  view.state.doc.forEach((node, offset) => {
    if (
      sourceNode ||
      !isRichTextBlockNode(node) ||
      String(node.attrs[BlockNode.id]) !== sourceId
    )
      return
    sourcePosition = offset
    sourceNode = node
  })
  if (sourcePosition === undefined || !sourceNode) return false
  if (drop >= sourcePosition && drop <= sourcePosition + sourceNode.nodeSize) {
    event.preventDefault()
    return true
  }

  const transaction = view.state.tr.delete(
    sourcePosition,
    sourcePosition + sourceNode.nodeSize
  )
  const insertPosition = transaction.mapping.map(drop)
  transaction.insert(insertPosition, sourceNode)
  transaction.scrollIntoView()
  event.preventDefault()
  view.dispatch(transaction)
  return true
}

function isRichTextBlockNode(node: ProseMirrorNode): boolean {
  return node.type.spec.group?.split(' ').includes('richTextBlock') ?? false
}

function hasNestedRichTextBlock(doc: ProseMirrorNode): boolean {
  let nested = false
  doc.descendants((node, position) => {
    if (isRichTextBlockNode(node) && doc.resolve(position).depth !== 0) {
      nested = true
      return false
    }
    return !nested
  })
  return nested
}

function renewPastedBlockIds(slice: Slice): Slice {
  return new Slice(
    renewPastedContent(slice.content),
    slice.openStart,
    slice.openEnd
  )
}

function renewPastedContent(content: Fragment): Fragment {
  const nodes: Array<ProseMirrorNode> = []
  content.forEach(node => nodes.push(renewPastedNode(node)))
  return Fragment.fromArray(nodes)
}

function renewPastedNode(node: ProseMirrorNode): ProseMirrorNode {
  const content = renewPastedContent(node.content)
  const groups = node.type.spec.group?.split(' ') ?? []
  if (!groups.includes('richTextBlock')) return node.copy(content)
  const id = createId()
  const snapshot = decodeBlockValue(node.attrs[richTextBlockValueAttribute])
  return node.type.create(
    {
      ...node.attrs,
      [BlockNode.id]: id,
      [richTextBlockValueAttribute]: snapshot
        ? {...snapshot, [BlockNode.id]: id}
        : null
    },
    content,
    node.marks
  )
}
