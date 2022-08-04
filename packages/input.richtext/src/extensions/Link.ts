import {Mark, mergeAttributes} from '@tiptap/core'

export interface LinkOptions {
  /**
   * A list of HTML attributes to be rendered.
   */
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    link: {
      /**
       * Set a link mark
       */
      setLink: (attributes: {href: string; target?: string}) => ReturnType
      /**
       * Toggle a link mark
       */
      toggleLink: (attributes: {href: string; target?: string}) => ReturnType
      /**
       * Unset a link mark
       */
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

  /*addPasteRules() {
    return [
      markPasteRule({
        find: text =>
          find(text)
            .filter(link => link.isLink)
            .map(link => ({
              text: link.value,
              index: link.start,
              data: link
            })),
        type: this.type,
        getAttributes: match => ({
          href: match.data?.href
        })
      })
    ]
  }*/
})
