import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {select} from 'alinea/input/select'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const options = {
  1: 'Option 1',
  2: 'Option 2'
} as const

export function SelectInput() {
  const selectField = useField(select('Select', options))
  const readonlySelectField = useField(
    select('Select (read-only)', options, {readonly: true, initialValue: '1'})
  )
  return (
    <UIStory>
      <VStack>
        <InputField {...selectField} />
        <InputField {...readonlySelectField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Select'
}
