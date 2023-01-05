import {dashboardDecorator} from '@alinea/dashboard/DashboardStory'
import {useField} from '@alinea/editor'
import {InputField} from '@alinea/editor/view/InputField'
import {text} from '@alinea/input.text'
import {VStack} from '@alinea/ui'

export function TextInput() {
  const textField = useField(text('Text'))
  const focusedTextField = useField(text('Text (autofocus)', {autoFocus: true}))
  const readonlyTextField = useField(
    text('Text (read-only)', {readonly: true, initialValue: 'Hello world'})
  )
  return (
    <VStack>
      <InputField {...textField} />
      <InputField {...focusedTextField} />
      <InputField {...readonlyTextField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Text',
  decorators: dashboardDecorator()
}
