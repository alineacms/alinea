import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {text} from 'alinea/input/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function TextInput() {
  const textField = useField(text('Text'))
  const focusedTextField = useField(text('Text (autofocus)', {autoFocus: true}))
  const readonlyTextField = useField(
    text('Text (read-only)', {readonly: true, initialValue: 'Hello world'})
  )
  return (
    <UIStory>
      <VStack>
        <InputField {...textField} />
        <InputField {...focusedTextField} />
        <InputField {...readonlyTextField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Text'
}
