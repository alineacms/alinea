import styler from '@alinea/styler'
import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import BulletList from '@tiptap/extension-bullet-list'
import Document from '@tiptap/extension-document'
import Dropcursor from '@tiptap/extension-dropcursor'
import FloatingMenu from '@tiptap/extension-floating-menu'
import Gapcursor from '@tiptap/extension-gapcursor'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
import Highlight from '@tiptap/extension-highlight'
import History from '@tiptap/extension-history'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Italic from '@tiptap/extension-italic'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import SubScript from '@tiptap/extension-subscript'
import SuperScript from '@tiptap/extension-superscript'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Text from '@tiptap/extension-text'
import TextAlign from '@tiptap/extension-text-align'
import css from './Extensions.module.css'
import {Link} from './extensions/Link.js'
import Small from './extensions/Small.js'

const styles = styler(css)

export const extensions = {
  Document,
  Text,
  Paragraph: Paragraph.configure({
    HTMLAttributes: {
      class: styles.Paragraph()
    }
  }),
  Small,
  Bold,
  Italic,
  Strike,
  HorizontalRule,
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
  Heading: Heading.configure({
    HTMLAttributes: {
      class: styles.Heading()
    }
  }),
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
  SuperScript,
  SubScript,
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
  History
}
