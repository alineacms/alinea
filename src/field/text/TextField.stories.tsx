import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {text} from 'alinea/field/text'
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

export function TextField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Text'
}
