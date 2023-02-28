import {dashboardDecorator} from 'alinea/dashboard/DashboardStory'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {json} from 'alinea/input/json'
import {VStack} from 'alinea/ui'

export function JsonInput() {
  const jsonField = useField(json('Json'))
  const focusedJsonField = useField(json('Json (autofocus)', {autoFocus: true}))
  const readonlyJsonField = useField(json('Json (read-only)', {readonly: true}))
  return (
    <VStack>
      <InputField {...jsonField} />
      <InputField {...focusedJsonField} />
      <InputField {...readonlyJsonField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Json',
  decorators: dashboardDecorator()
}
