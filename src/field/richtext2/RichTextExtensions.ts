import type {Schema} from '#/core/Schema.js'
import {BlockNode} from '#/core/TextDoc.js'
import {entries} from '#/core/util/Objects.js'
import styler from '@alinea/styler'
import {
  Mark,
  mergeAttributes,
  Node as TipTapNode,
  type AnyExtension
} from '@tiptap/core'
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
import css from './RichTextExtensions.module.css'

const styles = styler(css)

interface MarkOptions {
  HTMLAttributes: Record<string, unknown>
}

interface LinkAttributes {
  'data-id'?: string
  'data-entry'?: string
  'data-link'?: string
  'data-suffix'?: string
  href?: string
  target?: string
  title?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    link: {
      setLink: (attributes: LinkAttributes) => ReturnType
      toggleLink: (attributes: LinkAttributes) => ReturnType
      unsetLink: () => ReturnType
    }
    small: {
      setSmall: () => ReturnType
      toggleSmall: () => ReturnType
      unsetSmall: () => ReturnType
    }
  }
}

const Link = Mark.create<MarkOptions>({
  name: 'link',
  priority: 1000,
  keepOnSplit: false,
  addOptions() {
    return {HTMLAttributes: {rel: 'noopener noreferrer nofollow'}}
  },
  addAttributes() {
    return {
      'data-id': {default: null},
      'data-entry': {default: null},
      'data-link': {default: null},
      'data-suffix': {default: null},
      href: {default: null},
      target: {default: this.options.HTMLAttributes.target},
      title: {default: null}
    }
  },
  parseHTML() {
    return [{tag: 'a:not([href *= "javascript:" i])'}]
  },
  renderHTML({HTMLAttributes}) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0
    ]
  },
  addKeyboardShortcuts() {
    return {'Mod-k': () => this.editor.commands.setLink({})}
  },
  addCommands() {
    return {
      setLink:
        attributes =>
        ({chain}) =>
          chain().setMark(this.name, attributes).run(),
      toggleLink:
        attributes =>
        ({chain}) =>
          chain()
            .toggleMark(this.name, attributes, {extendEmptyMarkRange: true})
            .run(),
      unsetLink:
        () =>
        ({chain}) =>
          chain().unsetMark(this.name, {extendEmptyMarkRange: true}).run()
    }
  }
})

const Small = Mark.create<MarkOptions>({
  name: 'small',
  addOptions() {
    return {HTMLAttributes: {}}
  },
  parseHTML() {
    return [{tag: 'small'}]
  },
  renderHTML({HTMLAttributes}) {
    return [
      'small',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0
    ]
  },
  addCommands() {
    return {
      setSmall:
        () =>
        ({commands}) =>
          commands.setMark(this.name),
      toggleSmall:
        () =>
        ({commands}) =>
          commands.toggleMark(this.name),
      unsetSmall:
        () =>
        ({commands}) =>
          commands.unsetMark(this.name)
    }
  }
})

const StyledHeading = Heading.extend({
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
  }
})

export function richTextDocumentExtension(hasEmbeddedBlocks: boolean) {
  return Document.extend({
    content: hasEmbeddedBlocks ? '(block | richTextBlock)+' : 'block+'
  })
}

export function defaultExtensions(): Array<AnyExtension> {
  return [
    Text,
    Paragraph.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.paragraph()}
    }),
    Small.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.small()}
    }),
    Bold.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.bold()}
    }),
    Italic.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.italic()}
    }),
    Strike.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.strike()}
    }),
    HorizontalRule.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.rule()}
    }),
    BulletList.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.bulletList()}
    }),
    OrderedList.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.orderedList()}
    }),
    ListItem.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.listItem()}
    }),
    Blockquote.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.blockquote()}
    }),
    HardBreak,
    StyledHeading,
    TextAlign.configure({types: ['heading', 'paragraph']}),
    Dropcursor,
    Gapcursor,
    Link.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.link()}
    }),
    FloatingMenu,
    Superscript.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.superscript()}
    }),
    Subscript.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.subscript()}
    }),
    Table.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.table()}
    }),
    TableCell.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.tableCell()}
    }),
    TableHeader.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.tableHeader()}
    }),
    TableRow,
    Highlight.configure({
      HTMLAttributes: {class: styles.RichTextExtensions.highlight()}
    }),
    UndoRedo
  ]
}

export function blockExtensions(
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
        return {[BlockNode.id]: {default: null}}
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
