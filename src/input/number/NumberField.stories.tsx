import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {number} from 'alinea/input/number'
import {VStack} from 'alinea/ui'

export function numberInput() {
  const numberField = useField(number('Number'))
  const readonlyNumberField = useField(
    number('Number (read-only)', {readonly: true, initialValue: 0})
  )
  return (
    <VStack>
      <InputField {...numberField} />
      <InputField {...readonlyNumberField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Number'
}
