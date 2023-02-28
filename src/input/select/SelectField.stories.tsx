import {dashboardDecorator} from 'alinea/dashboard/DashboardStory'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {select} from 'alinea/input/select'
import {VStack} from 'alinea/ui'

const options = {
  1: 'Option 1',
  2: 'Option 2'
}

export function SelectInput() {
  const selectField = useField(select('Select', options))
  const readonlySelectField = useField(
    select('Select (read-only)', options, {readonly: true, initialValue: 1})
  )
  return (
    <VStack>
      <InputField {...selectField} />
      <InputField {...readonlySelectField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Select',
  decorators: dashboardDecorator()
}
