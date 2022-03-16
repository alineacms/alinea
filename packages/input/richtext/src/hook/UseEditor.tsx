// Source: https://gist.github.com/ryanto/4a431d822a98770c4ca7905d9b7b07da

import {useForceUpdate} from '@alinea/ui'
import {EditorOptions} from '@tiptap/core'
import {Editor} from '@tiptap/react'
import {DependencyList, useEffect, useState} from 'react'

export const useEditor = (
  options: Partial<EditorOptions> = {},
  deps: DependencyList = []
) => {
  const [editor, setEditor] = useState<Editor>(() => new Editor(options))
  const forceUpdate = useForceUpdate()

  useEffect(() => {
    let instance: Editor
    if (editor.isDestroyed) {
      instance = new Editor(options)
      setEditor(instance)
    } else {
      instance = editor
    }
    instance.on('transaction', forceUpdate)
    return () => instance.destroy()
  }, deps)

  return editor
}
