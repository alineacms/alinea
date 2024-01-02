import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {path} from 'alinea/input/path'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type({
  path: path('Path')
})

export function PathField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm type={fields} form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Path'
}
