import {Mark, mergeAttributes} from '@tiptap/core'

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
        default: null
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
        ({commands}) => {
          return commands.setMark(this.name, attributes)
        },
      toggleAnchor:
        attributes =>
        ({commands}) => {
          return commands.toggleMark(this.name, attributes)
        },
      unsetAnchor:
        () =>
        ({commands}) => {
          return commands.unsetMark(this.name)
        }
    }
  }
})

export default Anchor
