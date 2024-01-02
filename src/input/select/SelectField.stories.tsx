import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {select} from 'alinea/input/select'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const options = {
  1: 'Option 1',
  2: 'Option 2'
}

const fields = type({
  select: select('Select', options),
  readOnly: select('Select (read-only)', options, {
    readOnly: true,
    initialValue: '1'
  })
})

export function SelectField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} type={fields} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Select'
}
