import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {date} from 'alinea/input/date'
import {VStack} from 'alinea/ui'

export function DateInput() {
  const dateField = useField(date('Date', {}))
  const focusedDateField = useField(date('Date', {autoFocus: true}))
  const readonlyDateField = useField(
    date('Date (read-only)', {readonly: true, initialValue: '1900-01-01'})
  )
  return (
    <VStack>
      <InputField {...dateField} />
      <InputField {...focusedDateField} />
      <InputField {...readonlyDateField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Date'
}
