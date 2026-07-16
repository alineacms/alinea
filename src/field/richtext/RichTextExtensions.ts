import type {Schema} from '#/core/Schema.js'
import {createId} from '#/core/Id.js'
import {BlockNode} from '#/core/TextDoc.js'
import {entries} from '#/core/util/Objects.js'
import {createUniqueAnchor, isGeneratedAnchor} from 'alinea/core/util/Anchors'
import {slugify} from 'alinea/core/util/Slugs'
import styler from '@alinea/styler'
import {
  Extension,
  mergeAttributes,
  Node as TipTapNode,
  type AnyExtension
} from '@tiptap/core'
import {Fragment, type Node as ProseMirrorNode, Slice} from '@tiptap/pm/model'
import {Plugin, type Transaction} from '@tiptap/pm/state'
import {dropPoint} from '@tiptap/pm/transform'
import type {EditorView} from '@tiptap/pm/view'
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
import Anchor from './extensions/Anchor.js'
import {Link} from './extensions/Link.js'
import Small from './extensions/Small.js'
import css from './RichTextExtensions.module.css'

const styles = styler(css)

function headingExtension(getEntryAnchors?: () => Iterable<string>) {
  return Heading.extend({
    addAttributes() {
      return {
        ...(this.parent?.() ?? {}),
        _anchor: {
          default: null,
          parseHTML: element =>
            element.getAttribute('data-anchor') || element.id || null
        }
      }
    },
    renderHTML({node, HTMLAttributes}) {
      const level = this.options.levels.includes(node.attrs.level)
        ? node.attrs.level
        : this.options.levels[0]
      const {_anchor, ...attributes} = HTMLAttributes
      return [
        `h${level}`,
        mergeAttributes(
          attributes,
          typeof _anchor === 'string'
            ? {id: _anchor, 'data-anchor': _anchor}
            : {},
          {class: styles.RichTextExtensions.heading(`level${level}`)}
        ),
        0
      ]
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          appendTransaction(transactions, oldState, newState) {
            const tr = newState.tr
            let modified = false
            const anchors = entryAnchorsOutsideDocument(
              getEntryAnchors?.() ?? [],
              oldState.doc
            )
            for (const anchor of inlineAnchors(newState.doc))
              anchors.add(anchor)
            const headings: Array<{
              node: ProseMirrorNode
              pos: number
              custom: boolean
            }> = []
            newState.doc.descendants((node, pos) => {
              if (node.type.name !== 'heading') return
              const previous = previousHeading(transactions, oldState.doc, pos)
              headings.push({
                node,
                pos,
                custom: isCustomHeadingAnchor(node, previous)
              })
            })
            const customAnchors = new Map<number, string | undefined>()
            for (const {node, pos, custom} of headings) {
              if (!custom) continue
              customAnchors.set(
                pos,
                createUniqueAnchor(
                  typeof node.attrs._anchor === 'string'
                    ? node.attrs._anchor
                    : undefined,
                  anchors
                )
              )
            }
            for (const {node, pos, custom} of headings) {
              const anchor = custom
                ? customAnchors.get(pos)
                : createUniqueAnchor(slugify(node.textContent), anchors)
              const slug = anchor ?? null
              if (node.attrs._anchor === slug && !headingHasAnchorMark(node))
                continue
              if (node.attrs._anchor !== slug)
                tr.setNodeMarkup(pos, undefined, {...node.attrs, _anchor: slug})
              node.descendants((child, childPos) => {
                if (!child.isText || !child.text) return true
                const from = pos + childPos + 1
                const to = from + child.text.length
                tr.removeMark(from, to, newState.schema.marks.anchor)
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
}

function previousHeading(
  transactions: ReadonlyArray<Transaction>,
  oldDocument: ProseMirrorNode,
  position: number
): ProseMirrorNode | undefined {
  let oldPosition = position
  for (let index = transactions.length - 1; index >= 0; index--) {
    const mapped = transactions[index].mapping.invert().mapResult(oldPosition)
    if (mapped.deleted) return
    oldPosition = mapped.pos
  }
  const previous = oldDocument.nodeAt(oldPosition)
  return previous?.type.name === 'heading' ? previous : undefined
}

function entryAnchorsOutsideDocument(
  entryAnchors: Iterable<string>,
  document: ProseMirrorNode
): Set<string> {
  const counts = new Map<string, number>()
  for (const anchor of entryAnchors)
    counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
  for (const anchor of documentAnchors(document)) {
    const count = counts.get(anchor) ?? 0
    if (count <= 1) counts.delete(anchor)
    else counts.set(anchor, count - 1)
  }
  return new Set(counts.keys())
}

function documentAnchors(document: ProseMirrorNode): Set<string> {
  const result = inlineAnchors(document)
  document.descendants(node => {
    const anchor = node.attrs._anchor
    if (node.type.name === 'heading' && typeof anchor === 'string')
      result.add(anchor)
  })
  return result
}

function inlineAnchors(document: ProseMirrorNode): Set<string> {
  const result = new Set<string>()
  function visit(node: ProseMirrorNode, headingAnchor?: string) {
    const anchor = node.attrs._anchor
    const nextHeading =
      node.type.name === 'heading' && typeof anchor === 'string'
        ? anchor
        : headingAnchor
    if (node.isText)
      for (const mark of node.marks) {
        const id = mark.attrs.id
        if (
          mark.type.name === 'anchor' &&
          typeof id === 'string' &&
          id !== nextHeading
        )
          result.add(id)
      }
    node.forEach(child => visit(child, nextHeading))
  }
  visit(document)
  return result
}

function headingHasAnchorMark(heading: ProseMirrorNode): boolean {
  let found = false
  heading.descendants(node => {
    if (!node.isText) return !found
    if (node.marks.some(mark => mark.type.name === 'anchor')) found = true
    return !found
  })
  return found
}

function isCustomHeadingAnchor(
  heading: ProseMirrorNode,
  previous: ProseMirrorNode | undefined
): boolean {
  const anchor = heading.attrs._anchor
  const generated = slugify(heading.textContent)
  if (!previous)
    return typeof anchor === 'string' && !isGeneratedAnchor(anchor, generated)
  const previousAnchor = previous.attrs._anchor
  if (heading.textContent === previous.textContent && anchor !== previousAnchor)
    return (
      anchor == null ||
      (typeof anchor === 'string' && !isGeneratedAnchor(anchor, generated))
    )
  return (
    typeof previousAnchor === 'string' &&
    !isGeneratedAnchor(previousAnchor, slugify(previous.textContent))
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

export function defaultExtensionConfig(
  getEntryAnchors?: () => Iterable<string>
) {
  return createExtensions(getEntryAnchors)
}

export function defaultExtensions(
  getEntryAnchors?: () => Iterable<string>
): Array<AnyExtension> {
  return Object.values(defaultExtensionConfig(getEntryAnchors))
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

function createExtensions(getEntryAnchors?: () => Iterable<string>) {
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
    Heading: headingExtension(getEntryAnchors),
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
