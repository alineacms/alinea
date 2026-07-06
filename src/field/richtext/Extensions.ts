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
import Image from '@tiptap/extension-image'
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

const ImageWithReferenceAttributes = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('width')
        },
        renderHTML(attributes) {
          if (!attributes.width) return {}
          return {width: attributes.width}
        }
      },
      height: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('height')
        },
        renderHTML(attributes) {
          if (!attributes.height) return {}
          return {height: attributes.height}
        }
      },
      _id: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('data-id')
        },
        renderHTML(attributes) {
          if (!attributes._id) return {}
          return {'data-id': attributes._id}
        }
      },
      _entry: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('data-entry')
        },
        renderHTML(attributes) {
          if (!attributes._entry) return {}
          return {'data-entry': attributes._entry}
        }
      },
      _link: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('data-link')
        },
        renderHTML(attributes) {
          if (!attributes._link) return {}
          return {'data-link': attributes._link}
        }
      }
    }
  },
  addNodeView() {
    return ({editor, getPos, node}) => {
      const frame = document.createElement('span')
      const image = document.createElement('img')
      const handle = document.createElement('span')

      frame.className = styles.ImageFrame()
      image.className = styles.Image()
      handle.className = styles.ImageResizeHandle()
      handle.contentEditable = 'false'
      handle.setAttribute('aria-hidden', 'true')
      frame.contentEditable = 'false'
      frame.append(image, handle)

      function updateImageAttributes() {
        const src = node.attrs.src
        const alt = node.attrs.alt
        const title = node.attrs.title
        const width = node.attrs.width
        const height = node.attrs.height
        if (typeof src === 'string') image.src = src
        else image.removeAttribute('src')
        if (typeof alt === 'string') image.alt = alt
        else image.removeAttribute('alt')
        if (typeof title === 'string') image.title = title
        else image.removeAttribute('title')
        if (typeof width === 'string' || typeof width === 'number') {
          image.style.width = `${width}px`
        } else {
          image.style.removeProperty('width')
        }
        if (typeof height === 'string' || typeof height === 'number') {
          image.style.height = `${height}px`
        } else {
          image.style.removeProperty('height')
        }
      }

      function setImageSize(width: number, height: number | undefined) {
        const pos = getPos()
        if (typeof pos !== 'number') return
        editor
          .chain()
          .focus(null, {scrollIntoView: false})
          .command(({tr}) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              height:
                height === undefined ? node.attrs.height : Math.round(height),
              width: Math.round(width)
            })
            return true
          })
          .run()
      }

      handle.addEventListener('pointerdown', event => {
        event.preventDefault()
        const startX = event.clientX
        const startWidth = image.getBoundingClientRect().width
        const startHeight = image.getBoundingClientRect().height
        const ratio =
          startWidth > 0 && startHeight > 0
            ? startHeight / startWidth
            : undefined

        function onPointerMove(event: PointerEvent) {
          const width = Math.max(80, startWidth + event.clientX - startX)
          image.style.width = `${Math.round(width)}px`
          if (ratio) image.style.height = `${Math.round(width * ratio)}px`
        }

        function onPointerUp(event: PointerEvent) {
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          const width = Math.max(80, startWidth + event.clientX - startX)
          setImageSize(width, ratio ? width * ratio : undefined)
        }

        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp, {once: true})
      })

      updateImageAttributes()

      return {
        dom: frame,
        update(nextNode) {
          if (nextNode.type !== node.type) return false
          node = nextNode
          updateImageAttributes()
          return true
        }
      }
    }
  }
})

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
  Image: ImageWithReferenceAttributes.configure({
    HTMLAttributes: {
      class: styles.Image()
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
  History
}
