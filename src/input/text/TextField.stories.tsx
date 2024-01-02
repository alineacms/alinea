import {track, type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {text} from 'alinea/input/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type({
  text: text('Text', {initialValue: 'Hello world'}),
  focused: text('Text (autofocus)', {autoFocus: true}),
  readOnly: text('Text (read-only)', {
    readOnly: true,
    initialValue: 'Hello world'
  })
})

track.options(fields.text, get => {
  const value = get(fields.text)
  return {
    help: `Input is ${value.length} characters`
  }
})

export function TextField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} type={fields} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Text'
}
