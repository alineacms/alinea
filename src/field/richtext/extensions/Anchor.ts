import {getMarkRange, Mark, mergeAttributes, type Editor} from '@tiptap/core'
import type {MarkType} from '@tiptap/pm/model'
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
          tr.removeMark(from, to, anchorType)
          if (!setHeadingAnchor(tr, attributes.id, anchorType))
            tr.addMark(from, to, anchorType.create(attributes))
          if (dispatch) dispatch()
          return true
        },
      toggleAnchor:
        attributes =>
        ({commands, editor}) => {
          return currentAnchor(editor)
            ? commands.unsetAnchor()
            : commands.setAnchor(attributes)
        },
      unsetAnchor:
        () =>
        ({tr, state, dispatch}) => {
          const anchorType = state.schema.marks[this.name]
          const range = getMarkRange(tr.selection.$from, anchorType)
          const {from, to} = range ?? tr.selection
          tr.removeMark(from, to, anchorType)
          setHeadingAnchor(tr, null, anchorType)
          if (dispatch) dispatch()
          return true
        }
    }
  }
})

export function currentAnchor(editor: Editor): string | undefined {
  const heading = editor.getAttributes('heading')._anchor
  if (typeof heading === 'string') return heading
  const inline = editor.getAttributes('anchor').id
  return typeof inline === 'string' ? inline : undefined
}

function setHeadingAnchor(
  transaction: Transaction,
  anchor: string | null,
  anchorType: MarkType
): boolean {
  const {$from} = transaction.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'heading') continue
    const position = $from.before(depth)
    transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      _anchor: anchor
    })
    transaction.removeMark(
      position + 1,
      position + node.content.size + 1,
      anchorType
    )
    return true
  }
  return false
}

export default Anchor
