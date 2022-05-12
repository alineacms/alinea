import {Extension} from '@tiptap/core'
import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import BulletList from '@tiptap/extension-bullet-list'
import Document from '@tiptap/extension-document'
import Dropcursor from '@tiptap/extension-dropcursor'
import Gapcursor from '@tiptap/extension-gapcursor'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import Text from '@tiptap/extension-text'
import TextAlign from '@tiptap/extension-text-align'

// These come from the tiptap starter kut, but we omit:
// code, codeblock -> these can be achieved using a block
// history -> needs to be configured on the yjs side
// horizontal rule -> to be considered

export const RichTextKit = Extension.create({
  name: 'richTextKit',
  addExtensions() {
    return [
      Document,
      Text,
      Paragraph,
      Blockquote,
      Bold,
      Italic,
      Strike,
      BulletList,
      OrderedList,
      ListItem,
      HardBreak,
      Heading,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),

      Dropcursor,
      Gapcursor,
      Link.configure({
        openOnClick: false
      })
    ]
  }
})
