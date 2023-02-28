// Source: https://github.com/yjs/y-prosemirror/issues/114#issuecomment-1180235892

import {Collaboration} from '@tiptap/extension-collaboration'
import {ySyncPlugin, yUndoPlugin, yUndoPluginKey} from 'y-prosemirror'

export const CollaborationExtension = Collaboration.extend({
  addProseMirrorPlugins() {
    const fragment = this.options.fragment
      ? this.options.fragment
      : this.options.document.getXmlFragment(this.options.field)

    const yUndoPluginInstance = yUndoPlugin()
    const originalUndoPluginView = yUndoPluginInstance.spec.view
    yUndoPluginInstance.spec.view = (view: any) => {
      const undoManager = yUndoPluginKey.getState(view.state).undoManager
      if (undoManager.restore) {
        undoManager.restore()
        undoManager.restore = () => {}
      }
      const viewRet = originalUndoPluginView(view)
      return {
        destroy: () => {
          const hasUndoManSelf = undoManager.trackedOrigins.has(undoManager)
          const observers = undoManager._observers
          undoManager.restore = () => {
            if (hasUndoManSelf) {
              undoManager.trackedOrigins.add(undoManager)
            }
            undoManager.doc.on(
              'afterTransaction',
              undoManager.afterTransactionHandler
            )
            undoManager._observers = observers
          }
          viewRet.destroy()
        }
      }
    }
    return [ySyncPlugin(fragment), yUndoPluginInstance]
  }
})
