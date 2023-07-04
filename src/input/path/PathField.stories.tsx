import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {path} from 'alinea/input/path'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function PathField() {
  const pathField = useField(path('Path'))
  return (
    <UIStory>
      <VStack>
        <InputField {...pathField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Path'
}
