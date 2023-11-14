import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {date} from 'alinea/input/date'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function DateField() {
  const dateField = useField(date('Date', {}))
  const focusedDateField = useField(date('Date', {autoFocus: true}))
  const readonlyDateField = useField(
    date('Date (read-only)', {readOnly: true, initialValue: '1900-01-01'})
  )
  return (
    <UIStory>
      <VStack>
        <InputField {...dateField} />
        <InputField {...focusedDateField} />
        <InputField {...readonlyDateField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Date'
}
