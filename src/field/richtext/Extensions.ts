import styler from '@alinea/styler'
import {mergeAttributes} from '@tiptap/core'
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
import SubScript from '@tiptap/extension-subscript'
import SuperScript from '@tiptap/extension-superscript'
import {Table, TableCell, TableHeader, TableRow} from '@tiptap/extension-table'
import Text from '@tiptap/extension-text'
import TextAlign from '@tiptap/extension-text-align'
import {Dropcursor, Gapcursor, UndoRedo} from '@tiptap/extensions'
import css from './Extensions.module.css'
import {Link} from './extensions/Link.js'
import Small from './extensions/Small.js'

const styles = styler(css)

const HeadingWithClasses = Heading.extend({
  renderHTML({node, HTMLAttributes}) {
    const level = this.options.levels.includes(node.attrs.level)
      ? node.attrs.level
      : this.options.levels[0]
    return [
      `h${level}`,
      mergeAttributes(HTMLAttributes, {
        class: styles.Heading(`level${level}`)
      }),
      0
    ]
  }
})

export const extensions = {
  Document,
  Text,
  Paragraph: Paragraph.configure({
    HTMLAttributes: {
      class: styles.Paragraph()
    }
  }),
  Small: Small.configure({
    HTMLAttributes: {
      class: styles.Small()
    }
  }),
  Bold: Bold.configure({
    HTMLAttributes: {
      class: styles.Bold()
    }
  }),
  Italic: Italic.configure({
    HTMLAttributes: {
      class: styles.Italic()
    }
  }),
  Strike: Strike.configure({
    HTMLAttributes: {
      class: styles.Strike()
    }
  }),
  HorizontalRule: HorizontalRule.configure({
    HTMLAttributes: {
      class: styles.HorizontalRule()
    }
  }),
  BulletList: BulletList.configure({
    HTMLAttributes: {
      class: styles.BulletList()
    }
  }),
  OrderedList: OrderedList.configure({
    HTMLAttributes: {
      class: styles.OrderedList()
    }
  }),
  ListItem: ListItem.configure({
    HTMLAttributes: {
      class: styles.ListItem()
    }
  }),
  Blockquote: Blockquote.configure({
    HTMLAttributes: {
      class: styles.Blockquote()
    }
  }),
  HardBreak,
  Heading: HeadingWithClasses,
  TextAlign: TextAlign.configure({
    types: ['heading', 'paragraph']
  }),
  Dropcursor,
  Gapcursor,
  Link: Link.configure({
    HTMLAttributes: {
      class: styles.Link()
    }
  }),
  FloatingMenu,
  SuperScript: SuperScript.configure({
    HTMLAttributes: {
      class: styles.SuperScript()
    }
  }),
  SubScript: SubScript.configure({
    HTMLAttributes: {
      class: styles.SubScript()
    }
  }),
  Table: Table.configure({
    HTMLAttributes: {
      class: styles.Table()
    }
  }),
  TableCell: TableCell.configure({
    HTMLAttributes: {
      class: styles.TableCell()
    }
  }),
  TableHeader: TableHeader.configure({
    HTMLAttributes: {
      class: styles.TableHeader()
    }
  }),
  TableRow,
  Highlight: Highlight.configure({
    HTMLAttributes: {
      class: styles.Highlight()
    }
  }),
  UndoRedo
}
