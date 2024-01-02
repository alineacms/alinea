import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {code} from 'alinea/input/code'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Field', {
  code: code('Code'),
  disabled: code('Code (read-only)', {
    readOnly: true,
    initialValue: `console.log('Hello world!')`
  })
})

export function CodeField() {
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
  title: 'Fields / Code'
}
