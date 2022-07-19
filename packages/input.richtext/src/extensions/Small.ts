import {Mark, markInputRule, markPasteRule, mergeAttributes} from '@tiptap/core'

export interface SmallOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    small: {
      /**
       * Set a small mark
       */
      setSmall: () => ReturnType
      /**
       * Toggle a small mark
       */
      toggleSmall: () => ReturnType
      /**
       * Unset a small mark
       */
      unsetSmall: () => ReturnType
    }
  }
}

export const starInputRegex = /(?:^|\s)((?:\*\*)((?:[^*]+))(?:\*\*))$/
export const starPasteRegex = /(?:^|\s)((?:\*\*)((?:[^*]+))(?:\*\*))/g
export const underscoreInputRegex = /(?:^|\s)((?:__)((?:[^__]+))(?:__))$/
export const underscorePasteRegex = /(?:^|\s)((?:__)((?:[^__]+))(?:__))/g

const Small = Mark.create<SmallOptions>({
  name: 'small',

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  parseHTML() {
    return [
      {
        tag: 'small'
      }
    ]
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
  },

  addKeyboardShortcuts() {
    return {
      'Mod-small': () => this.editor.commands.toggleSmall(),
      'Mod-Small': () => this.editor.commands.toggleSmall()
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: starInputRegex,
        type: this.type
      }),
      markInputRule({
        find: underscoreInputRegex,
        type: this.type
      })
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: starPasteRegex,
        type: this.type
      }),
      markPasteRule({
        find: underscorePasteRegex,
        type: this.type
      })
    ]
  }
})

export default Small
