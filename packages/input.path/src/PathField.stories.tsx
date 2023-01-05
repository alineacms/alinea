import {InputField} from '@alinea/editor/view/InputField'
import {VStack} from '@alinea/ui'
import {dashboardDecorator} from '@alinea/dashboard/DashboardStory'
import {path} from '@alinea/input.path'
import {useField} from '@alinea/editor'

export function PathInput() {
  const pathField = useField(path('Path'))
  return (
    <VStack>
      <InputField {...pathField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Path',
  decorators: dashboardDecorator()
}
