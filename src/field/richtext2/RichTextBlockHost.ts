import type {NodeViewRenderer, NodeViewRendererProps} from '@tiptap/core'

export interface RichTextBlockHost {
  dom: HTMLDivElement
  getPos: NodeViewRendererProps['getPos']
  id: string
  typeName: string
}

export class RichTextBlockHosts {
  #hosts = new Map<HTMLDivElement, RichTextBlockHost>()
  #listeners = new Set<() => void>()
  #snapshot: Array<RichTextBlockHost> = []

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  snapshot = () => this.#snapshot

  nodeView(typeName: string): NodeViewRenderer {
    return ({node, getPos, editor}) => {
      const dom = document.createElement('div')
      dom.contentEditable = 'false'
      dom.dataset.richtextBlockHost = 'true'
      const host: RichTextBlockHost = {
        dom,
        getPos,
        id: String(node.attrs._id),
        typeName
      }
      this.#hosts.set(dom, host)
      this.#publish()
      return {
        dom,
        ignoreMutation: () => true,
        stopEvent(event) {
          const target = event.target
          const dragHandle =
            target instanceof Element &&
            target.closest('[data-richtext-drag-handle]')
          if (event.type === 'dragstart' && dragHandle) {
            const position = getPos()
            if (typeof position === 'number')
              editor.commands.setNodeSelection(position)
          }
          if (event.type.startsWith('drag') || event.type === 'drop')
            return false
          return !dragHandle
        },
        destroy: () => {
          this.#hosts.delete(dom)
          this.#publish()
        }
      }
    }
  }

  #publish() {
    this.#snapshot = Array.from(this.#hosts.values())
    for (const listener of this.#listeners) listener()
  }
}
