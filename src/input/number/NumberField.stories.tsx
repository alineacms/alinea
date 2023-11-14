import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {number} from 'alinea/input/number'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function NumberField() {
  const numberField = useField(number('Number'))
  const readonlyNumberField = useField(
    number('Number (read-only)', {readOnly: true, initialValue: 0})
  )
  return (
    <UIStory>
      <VStack>
        <InputField {...numberField} />
        <InputField {...readonlyNumberField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Number'
}
