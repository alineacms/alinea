import {Mark, mergeAttributes} from '@tiptap/core'

interface LinkAttributes {
  'data-id'?: string
  'data-entry'?: string
  'data-link'?: string
  'data-suffix'?: string
  href?: string
  target?: string
  title?: string
}

export interface LinkOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    link: {
      setLink: (attributes: LinkAttributes) => ReturnType
      toggleLink: (attributes: LinkAttributes) => ReturnType
      unsetLink: () => ReturnType
    }
  }
}

export const Link = Mark.create<LinkOptions>({
  name: 'link',
  priority: 1000,
  keepOnSplit: false,
  addOptions() {
    return {
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow'
      }
    }
  },
  addAttributes() {
    return {
      'data-id': {
        default: null
      },
      'data-entry': {
        default: null
      },
      'data-link': {
        default: null
      },
      'data-suffix': {
        default: null
      },
      href: {
        default: null
      },
      target: {
        default: this.options.HTMLAttributes.target
      },
      title: {
        default: null
      }
    }
  },
  parseHTML() {
    return [{tag: 'a:not([href *= "javascript:" i])'}]
  },
  renderHTML({HTMLAttributes}) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0
    ]
  },
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => this.editor.commands.setLink({})
    }
  },
  addCommands() {
    return {
      setLink:
        attributes =>
        ({chain}) => {
          return chain().setMark(this.name, attributes).run()
        },
      toggleLink:
        attributes =>
        ({chain}) => {
          return chain()
            .toggleMark(this.name, attributes, {extendEmptyMarkRange: true})
            .run()
        },
      unsetLink:
        () =>
        ({chain}) => {
          return chain()
            .unsetMark(this.name, {extendEmptyMarkRange: true})
            .run()
        }
    }
  }
})
