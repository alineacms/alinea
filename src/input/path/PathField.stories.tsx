import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {path} from 'alinea/input/path'
import {VStack} from 'alinea/ui'

export function PathInput() {
  const pathField = useField(path('Path'))
  return (
    <VStack>
      <InputField {...pathField} />
    </VStack>
  )
}

export default {
  title: 'Fields / Path'
}
