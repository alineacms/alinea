import styler from '@alinea/styler'
import {mergeAttributes} from '@tiptap/core'
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
import Anchor from './extensions/Anchor.js'
import {slugify} from 'alinea/core/util/Slugs'
import {Plugin} from '@tiptap/pm/state'
const styles = styler(css)

const HeadingWithClassesAndIds = Heading.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      _anchor: {default: null}
    }
  },
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
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(_transaction, _oldState, newState) {
          const tr = newState.tr
          let modified = false
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return
            const slug = slugify(node.textContent)
            if (node.attrs._anchor !== slug) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                _anchor: slug
              })

              node.descendants((child, childPos) => {
                if (!child.isText) return true
                if (!child.text) return true

                const from = pos + childPos + 1
                const to = from + child.text.length
                const anchorType = newState.schema.marks.anchor

                tr.addMark(from, to, anchorType.create({id: slug}))
                return false
              })

              modified = true
            }
          })
          return modified ? tr : null
        }
      })
    ]
  }
})

export const extensions = {
  Document,
  Text,
  Anchor: Anchor.configure({
    HTMLAttributes: {
      class: styles.Anchor()
    }
  }),
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
  Heading: HeadingWithClassesAndIds,
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
  History
}
