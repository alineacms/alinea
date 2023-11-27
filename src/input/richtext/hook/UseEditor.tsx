// Source: https://gist.github.com/ryanto/4a431d822a98770c4ca7905d9b7b07da

import {EditorOptions} from '@tiptap/core'
import {Editor} from '@tiptap/react'
import {useForceUpdate} from 'alinea/ui/hook/UseForceUpdate'
import {DependencyList, useEffect, useMemo} from 'react'

export const useEditor = (
  options: Partial<EditorOptions> = {},
  dependencies: DependencyList = []
) => {
  const editor = useMemo(() => new Editor(options), [])
  const forceUpdate = useForceUpdate()
  useEffect(() => {
    editor.on('transaction', forceUpdate)
    return () => editor.destroy()
  }, [editor])
  return editor
  /*const [editor, setEditor] = useState<Editor>(() => new Editor(options))
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
  }, dependencies)
  return editor*/
}
