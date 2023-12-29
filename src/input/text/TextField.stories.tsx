import {InputField} from 'alinea/editor/view/InputField'
import {text} from 'alinea/input/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const textField = text('Text')
const focusedTextField = text('Text (autofocus)', {autoFocus: true})
const readonlyTextField = text('Text (read-only)', {
  readOnly: true,
  initialValue: 'Hello world'
})

export function TextField() {
  return (
    <UIStory>
      <VStack>
        <InputField field={textField} />
        <InputField field={focusedTextField} />
        <InputField field={readonlyTextField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Text'
}
