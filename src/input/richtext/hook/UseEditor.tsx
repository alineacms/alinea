// Source: https://gist.github.com/ryanto/4a431d822a98770c4ca7905d9b7b07da

import {EditorOptions} from '@tiptap/core'
import {Editor} from '@tiptap/react'
import {useForceUpdate} from 'alinea/ui'
import {useEffect, useState} from 'react'

export const useEditor = (options: Partial<EditorOptions> = {}) => {
  const [editor] = useState<Editor>(() => new Editor(options))
  const forceUpdate = useForceUpdate()
  useEffect(() => {
    editor.on('transaction', () => {
      forceUpdate()
    })
    return () => editor.destroy()
  }, [])
  return editor
}
