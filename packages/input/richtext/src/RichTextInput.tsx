import {InputPath} from '@alinea/core'
import {Label, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import Collaboration from '@tiptap/extension-collaboration'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {RichTextField} from './RichTextField'
import css from './RichTextInput.module.scss'

const styles = fromModule(css)

export type RichTextInputProps<T> = {
  path: InputPath<string>
  field: RichTextField<T>
}

export function RichTextInput<T>({path, field}: RichTextInputProps<T>) {
  const {optional, help} = field.options
  const [content, fragment] = useInput(path)
  const editor = useEditor({
    content,
    extensions: [
      Collaboration.configure({fragment}),
      StarterKit.configure({history: false})
    ]
  })
  return (
    <div className={styles.root()}>
      <Label label={field.label} help={help} optional={optional}>
        <EditorContent className={styles.root.editor()} editor={editor} />
      </Label>
    </div>
  )
}
