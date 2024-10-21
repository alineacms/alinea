import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {object} from 'alinea/field/object'
import {text} from 'alinea/field/text/TextField'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Fields', {
  fields: {
    path: object('Object', {
      fields: {
        field1: text('Field 1'),
        field2: text('Field 2')
      }
    })
  }
})

export function ObjectField() {
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
  title: 'Fields / Object'
}
