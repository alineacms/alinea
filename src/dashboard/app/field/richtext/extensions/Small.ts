import {Mark, mergeAttributes} from '@tiptap/core'

export interface SmallOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    small: {
      setSmall: () => ReturnType
      toggleSmall: () => ReturnType
      unsetSmall: () => ReturnType
    }
  }
}

const Small = Mark.create<SmallOptions>({
  name: 'small',
  addOptions() {
    return {
      HTMLAttributes: {}
    }
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
        ({commands}) => {
          return commands.setMark(this.name)
        },
      toggleSmall:
        () =>
        ({commands}) => {
          return commands.toggleMark(this.name)
        },
      unsetSmall:
        () =>
        ({commands}) => {
          return commands.unsetMark(this.name)
        }
    }
  }
})

export default Small
