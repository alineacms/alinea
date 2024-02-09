import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {json} from 'alinea/field/json'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Field', {
  fields: {
    json: json('Json'),
    focused: json('Json (autofocus)', {autoFocus: true}),
    readOnly: json('Json (read-only)', {readOnly: true})
  }
})

export function JsonField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Json'
}
