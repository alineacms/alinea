import {getMarkRange, Mark, mergeAttributes} from '@tiptap/core'
import type {Transaction} from '@tiptap/pm/state'

interface AnchorAttributes {
  id: string
}

export interface AnchorOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    anchor: {
      setAnchor: (attributes: AnchorAttributes) => ReturnType
      toggleAnchor: (attributes: AnchorAttributes) => ReturnType
      unsetAnchor: () => ReturnType
    }
  }
}

const Anchor = Mark.create<AnchorOptions>({
  name: 'anchor',
  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-anchor'),
        renderHTML: attributes => {
          if (!attributes.id) return {}
          return {'data-anchor': attributes.id}
        }
      }
    }
  },
  parseHTML() {
    return [{tag: 'span[data-anchor]'}]
  },
  renderHTML({HTMLAttributes}) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0
    ]
  },
  addCommands() {
    return {
      setAnchor:
        attributes =>
        ({tr, state, dispatch}) => {
          const anchorType = state.schema.marks[this.name]
          const range = getMarkRange(tr.selection.$from, anchorType)
          const {from, to} = range ?? tr.selection
          setHeadingAnchor(tr, attributes.id)
          tr.removeMark(from, to, anchorType)
          tr.addMark(from, to, anchorType.create(attributes))
          if (dispatch) dispatch()
          return true
        },
      toggleAnchor:
        attributes =>
        ({commands}) => {
          return commands.toggleMark(this.name, attributes)
        },
      unsetAnchor:
        () =>
        ({tr, state, dispatch}) => {
          const anchorType = state.schema.marks[this.name]
          const range = getMarkRange(tr.selection.$from, anchorType)
          const {from, to} = range ?? tr.selection
          setHeadingAnchor(tr, null)
          tr.removeMark(from, to, anchorType)
          if (dispatch) dispatch()
          return true
        }
    }
  }
})

function setHeadingAnchor(transaction: Transaction, anchor: string | null) {
  const {$from} = transaction.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'heading') continue
    transaction.setNodeMarkup($from.before(depth), undefined, {
      ...node.attrs,
      _anchor: anchor
    })
    return
  }
}

export default Anchor
