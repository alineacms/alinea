import styler from '@alinea/styler'
import {Extension} from '@tiptap/core'
import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import BulletList from '@tiptap/extension-bullet-list'
import Document from '@tiptap/extension-document'
import Dropcursor from '@tiptap/extension-dropcursor'
import FloatingMenu from '@tiptap/extension-floating-menu'
import Gapcursor from '@tiptap/extension-gapcursor'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
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
import css from './RichTextKit.module.scss'
import {Link} from './extensions/Link.js'
import Small from './extensions/Small.js'

const styles = styler(css)

// These come from the tiptap starter kit, but we omit:
// code, codeblock -> these can be achieved using a block
// history -> needs to be configured on the yjs side

export const RichTextKit = Extension.create({
  name: 'richTextKit',
  addExtensions() {
    return [
      Document,
      Text,
      Paragraph.configure({
        HTMLAttributes: {
          class: styles.paragraph()
        }
      }),
      Small,
      Bold,
      Italic,
      Strike,
      HorizontalRule,
      BulletList.configure({
        HTMLAttributes: {
          class: styles.list()
        }
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: styles.list()
        }
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: styles.listItem()
        }
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: styles.blockquote()
        }
      }),
      HardBreak,
      Heading.configure({
        HTMLAttributes: {
          class: styles.heading()
        }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Dropcursor,
      Gapcursor,
      Link.configure({
        HTMLAttributes: {
          class: styles.link()
        }
      }),
      FloatingMenu,
      SuperScript,
      SubScript,
      Table.configure({
        HTMLAttributes: {
          class: styles.table()
        }
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: styles.td()
        }
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: styles.th()
        }
      }),
      TableRow
    ]
  }
})
