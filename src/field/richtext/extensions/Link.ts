import {getMarkRange, Mark, mergeAttributes} from '@tiptap/core'
import {Plugin, PluginKey, TextSelection} from '@tiptap/pm/state'

interface LinkAttributes {
  'data-id'?: string
  'data-entry'?: string
  'data-locale'?: string
  'data-anchor'?: string
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
    return {HTMLAttributes: {rel: 'noopener noreferrer nofollow'}}
  },
  addAttributes() {
    return {
      'data-id': {default: null},
      'data-entry': {default: null},
      'data-locale': {default: null},
      'data-anchor': {default: null},
      'data-link': {default: null},
      'data-suffix': {default: null},
      href: {default: null},
      target: {default: this.options.HTMLAttributes.target},
      title: {default: null}
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
    return {'Mod-k': () => this.editor.commands.setLink({})}
  },
  addCommands() {
    return {
      setLink:
        attributes =>
        ({chain}) =>
          chain().setMark(this.name, attributes).run(),
      toggleLink:
        attributes =>
        ({chain}) =>
          chain()
            .toggleMark(this.name, attributes, {extendEmptyMarkRange: true})
            .run(),
      unsetLink:
        () =>
        ({chain}) =>
          chain().unsetMark(this.name, {extendEmptyMarkRange: true}).run()
    }
  },
  addProseMirrorPlugins() {
    const type = this.type
    return [
      new Plugin({
        key: new PluginKey('linkClickSelection'),
        props: {
          // Clicking a link selects all of its text, so editing or removing
          // the link applies to the whole link rather than a part of it. A
          // second click places the caret within the selected link.
          handleClick(view, pos, event) {
            if (!view.editable || event.button !== 0) return false
            if (event.shiftKey || event.metaKey || event.ctrlKey) return false
            const target = event.target
            if (!(target instanceof Element)) return false
            const anchor = target.closest('a')
            if (!anchor || !view.dom.contains(anchor)) return false
            const {doc, selection} = view.state
            const range = getMarkRange(doc.resolve(pos), type)
            if (!range) return false
            if (selection.from === range.from && selection.to === range.to)
              return false
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.create(doc, range.from, range.to)
              )
            )
            return true
          }
        }
      })
    ]
  }
})
